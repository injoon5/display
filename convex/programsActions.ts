"use node";

import { compile } from "@matrix-panel/compiler";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { demoAction } from "./auth";
import { diagnosticValidator } from "./cards";
import { sha256Hex, toEtag } from "./lib/etag";

type Warning = {
  severity: string;
  message: string;
  line: number;
  col: number;
};

function toWarnings(
  diagnostics: Array<{
    severity: string;
    message: string;
    span?: { start: { line: number; column: number } };
  }>,
): Warning[] {
  return diagnostics.map((diagnostic) => ({
    severity: diagnostic.severity,
    message: diagnostic.message,
    line: diagnostic.span?.start.line ?? 1,
    col: diagnostic.span?.start.column ?? 1,
  }));
}

function assertMxr1(bytecode: Uint8Array): void {
  const magic = String.fromCharCode(
    bytecode[0] ?? 0,
    bytecode[1] ?? 0,
    bytecode[2] ?? 0,
    bytecode[3] ?? 0,
  );
  if (magic !== "MXR1") {
    throw new Error(`Invalid bytecode magic: expected MXR1, got ${magic}`);
  }
}

async function uploadBytecode(
  ctx: { storage: { generateUploadUrl: () => Promise<string> } },
  bytecode: Uint8Array,
): Promise<Id<"_storage">> {
  // Prefer generateUploadUrl + POST. Direct `ctx.storage.store(Blob)` hits
  // "BadHeader / Digest" on local anonymous Convex backends.
  const uploadUrl = await ctx.storage.generateUploadUrl();
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: Buffer.from(bytecode),
  });
  if (!uploadResponse.ok) {
    const detail = await uploadResponse.text();
    throw new Error(`Program upload failed (${uploadResponse.status}): ${detail}`);
  }
  const uploaded = (await uploadResponse.json()) as { storageId?: Id<"_storage"> };
  if (!uploaded.storageId) {
    throw new Error("Program upload missing storageId");
  }
  return uploaded.storageId;
}

/**
 * Canonical deploy path: always compile card sources with @matrix-panel/compiler
 * on the server. Client-supplied bytecode is never trusted.
 *
 * Each selected card gets its own MXR blob. The highest-priority card becomes the
 * initial active program; `devices.rotatePlaylist` rotates through the playlist
 * using each card's `dwellMs`.
 */
export const compileAndDeploy = demoAction({
  args: {
    cardIds: v.array(v.id("cards")),
    deviceId: v.id("devices"),
  },
  returns: v.object({
    etag: v.string(),
    size: v.number(),
    warnings: v.array(diagnosticValidator),
  }),
  handler: async (ctx, args) => {
    const cards: Doc<"cards">[] = await ctx.runQuery(internal.cards.getMany, {
      ids: args.cardIds,
    });
    if (cards.length === 0) {
      throw new Error("At least one card is required");
    }

    const device: Doc<"devices"> | null = await ctx.runQuery(internal.devices.getInternal, {
      id: args.deviceId,
    });
    if (!device) {
      throw new Error("Device not found");
    }

    const warnings: Warning[] = [];
    const compiledById = new Map<
      Id<"cards">,
      {
        bytecode: Uint8Array;
        bytecodeHash: string;
        slotMap: Array<{ index: number; path: string; type: string; sourceId: string }>;
        sources: string[];
        estimatedAmps: number;
      }
    >();

    for (const card of cards) {
      const result = compile(card.source);
      const cardWarnings = toWarnings(result.diagnostics);
      warnings.push(...cardWarnings);
      if (result.diagnostics.some((d) => d.severity === "error")) {
        throw new Error(
          `COMPILE_FAILED ${card.slug}: ${result.diagnostics
            .filter((d) => d.severity === "error")
            .map((d) => d.message)
            .join("; ")}`,
        );
      }
      assertMxr1(result.bytecode);
      compiledById.set(card._id, {
        bytecode: result.bytecode,
        bytecodeHash: await sha256Hex(result.bytecode),
        slotMap: result.slotMap.map((slot) => ({
          index: slot.index,
          path: slot.path,
          type: slot.type,
          sourceId: slot.sourceId,
        })),
        sources: result.sources,
        estimatedAmps: result.estimatedAmps,
      });
    }

    const primary = [...cards].sort((a, b) => b.priority - a.priority)[0]!;
    const primaryCompiled = compiledById.get(primary._id);
    if (!primaryCompiled) {
      throw new Error("Primary card compile missing");
    }

    const cardStorage: Array<{
      cardId: Id<"cards">;
      storageId: Id<"_storage">;
      bytecodeHash: string;
    }> = [];

    for (const card of cards) {
      const compiled = compiledById.get(card._id);
      if (!compiled) {
        continue;
      }
      await ctx.runMutation(internal.cards.patchCompiledArtifacts, {
        cardId: card._id,
        slotMap: compiled.slotMap,
        diagnostics: warnings.filter((w) => w.message.length > 0).slice(0, 32),
        estimatedAmps: compiled.estimatedAmps,
        sourceRefs: compiled.sources,
      });
      const storageId = await uploadBytecode(ctx, compiled.bytecode);
      cardStorage.push({
        cardId: card._id,
        storageId,
        bytecodeHash: compiled.bytecodeHash,
      });
    }

    const primaryStorage = cardStorage.find((entry) => entry.cardId === primary._id);
    if (!primaryStorage) {
      throw new Error("Primary card storage missing");
    }

    await ctx.runMutation(internal.devices.applyProgramDeployment, {
      deviceId: args.deviceId,
      cardIds: args.cardIds,
      primaryCardId: primary._id,
      cardStorage,
      storageId: primaryStorage.storageId,
      bytecodeHash: primaryStorage.bytecodeHash,
    });

    return {
      etag: toEtag(primaryStorage.bytecodeHash),
      size: primaryCompiled.bytecode.length,
      warnings,
    };
  },
});
