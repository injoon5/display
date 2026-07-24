"use node";

import { v } from "convex/values";
import { compile } from "@matrix-panel/compiler";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { dashboardAction } from "./auth";
import { diagnosticValidator } from "./cards";
import { sha256Hex, toEtag } from "./lib/etag";

type CompileAndDeployResult = {
  etag: string;
  size: number;
  warnings: Array<{
    severity: string;
    message: string;
    line: number;
    col: number;
  }>;
};

function diagnosticsToConvex(
  diagnostics: Array<{
    severity: string;
    message: string;
    span?: { start: { line: number; column: number } };
  }>,
): CompileAndDeployResult["warnings"] {
  return diagnostics.map((diagnostic) => ({
    severity: diagnostic.severity,
    message: diagnostic.message,
    line: diagnostic.span?.start.line ?? 1,
    col: diagnostic.span?.start.column ?? 1,
  }));
}

/**
 * Compiles card sources with the shared @matrix-panel/compiler package
 * (same code the dashboard runs) and deploys real MXR1 bytecode.
 */
export const compileAndDeployMxr = dashboardAction({
  args: {
    cardIds: v.array(v.id("cards")),
    deviceId: v.id("devices"),
    /** Optional precompiled MXR1 bytes from the browser (preferred). */
    bytecode: v.optional(v.bytes()),
  },
  returns: v.object({
    etag: v.string(),
    size: v.number(),
    warnings: v.array(diagnosticValidator),
  }),
  handler: async (ctx, args): Promise<CompileAndDeployResult> => {
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

    let bytecode: Uint8Array;
    let warnings: CompileAndDeployResult["warnings"] = [];

    if (args.bytecode && args.bytecode.byteLength > 0) {
      bytecode = new Uint8Array(args.bytecode);
    } else {
      // Compile the highest-priority enabled card with the shared compiler.
      const primary = [...cards].sort((a, b) => b.priority - a.priority)[0]!;
      const result = compile(primary.source);
      warnings = diagnosticsToConvex(result.diagnostics);
      if (result.diagnostics.some((d) => d.severity === "error")) {
        throw new Error(
          `COMPILE_FAILED: ${result.diagnostics
            .filter((d) => d.severity === "error")
            .map((d) => d.message)
            .join("; ")}`,
        );
      }
      bytecode = result.bytecode;

      // Persist slot map / diagnostics from the real compiler onto the card.
      await ctx.runMutation(internal.cards.patchCompiledArtifacts, {
        cardId: primary._id as Id<"cards">,
        slotMap: result.slotMap.map((slot) => ({
          index: slot.index,
          path: slot.path,
          type: slot.type,
          sourceId: slot.sourceId,
        })),
        diagnostics: warnings,
        estimatedAmps: result.estimatedAmps,
        sourceRefs: result.sources,
      });
    }

    const magic = String.fromCharCode(bytecode[0]!, bytecode[1]!, bytecode[2]!, bytecode[3]!);
    if (magic !== "MXR1") {
      throw new Error(`Invalid bytecode magic: expected MXR1, got ${magic}`);
    }

    const bytecodeHash = await sha256Hex(bytecode);
    const ab = bytecode.buffer.slice(
      bytecode.byteOffset,
      bytecode.byteOffset + bytecode.byteLength,
    ) as ArrayBuffer;
    const storageId = await ctx.storage.store(new Blob([ab], { type: "application/octet-stream" }), {
      sha256: bytecodeHash,
    });

    await ctx.runMutation(internal.devices.applyProgramDeployment, {
      deviceId: args.deviceId,
      cardIds: args.cardIds,
      storageId,
      bytecodeHash,
    });

    return {
      etag: toEtag(bytecodeHash),
      size: bytecode.length,
      warnings,
    };
  },
});
