import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { DataModel } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { internalQuery } from "./_generated/server";
import { dashboardAction } from "./auth";
import { cardValidator, diagnosticValidator } from "./cards";
import { sha256Hex, stripEtag, toEtag } from "./lib/etag";
import { ruleValidator } from "./rules";
import { sceneValidator } from "./scenes";

type SlotEntry = {
  index: number;
  path: string;
  type: string;
  sourceId: string;
};

type CardDoc = Doc<"cards">;
type DeviceDoc = Doc<"devices">;
type RuleDoc = Doc<"rules">;
type SceneDoc = Doc<"scenes">;
type CompileAndDeployResult = {
  etag: string;
  size: number;
  warnings: CardDoc["diagnostics"];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getByPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[part];
  }
  return current ?? null;
}

function buildGlobalSlotMap(cards: Array<{ slotMap: SlotEntry[] }>): SlotEntry[] {
  const seen = new Set<string>();
  const globalSlots: SlotEntry[] = [];
  for (const card of cards) {
    for (const slot of card.slotMap) {
      if (seen.has(slot.path)) {
        continue;
      }
      seen.add(slot.path);
      globalSlots.push({
        ...slot,
        index: globalSlots.length,
      });
    }
  }
  return globalSlots;
}

function buildProgramBytes(input: {
  deviceId: string;
  cards: Array<{
    id: string;
    slug: string;
    source: string;
    priority: number;
    dwellMs: number;
    slotMap: SlotEntry[];
  }>;
  scenes: Array<{ name: string; cardIds: string[]; enabled: boolean }>;
  rules: Array<{ name: string; condition: string; kind: string; priority: number; enabled: boolean }>;
}): Uint8Array {
  const slotMap = buildGlobalSlotMap(input.cards);
  const program = {
    format: "wall-matrix-panel.stage0",
    deviceId: input.deviceId,
    generatedAt: Date.now(),
    cards: input.cards,
    slotMap,
    scenes: input.scenes,
    rules: input.rules,
  };
  return new TextEncoder().encode(JSON.stringify(program));
}

function getLatestCompiledStorageId(
  cards: Array<{
    compiledStorageId?: Id<"_storage">;
  }>,
): Id<"_storage"> | null {
  return cards.find((card) => card.compiledStorageId)?.compiledStorageId ?? null;
}

const compileAndDeployHandler = async (ctx: GenericActionCtx<DataModel>, args: {
  cardIds: Id<"cards">[];
  deviceId: Id<"devices">;
}): Promise<CompileAndDeployResult> => {
  const cards: CardDoc[] = await ctx.runQuery(internal.cards.getMany, { ids: args.cardIds });
  if (cards.length === 0) {
    throw new Error("At least one card is required");
  }

  const device: DeviceDoc | null = await ctx.runQuery(api.devices.get, { id: args.deviceId });
  if (!device) {
    throw new Error("Device not found");
  }

  const scenes: SceneDoc[] = await ctx.runQuery(api.scenes.list, {});
  const rules: RuleDoc[] = await ctx.runQuery(api.rules.list, {});
  const warnings: CardDoc["diagnostics"] = cards.flatMap((card: CardDoc) => card.diagnostics);
  const bytecode = buildProgramBytes({
    deviceId: device._id,
    cards: cards.map((card: CardDoc) => ({
      id: card._id,
      slug: card.slug,
      source: card.source,
      priority: card.priority,
      dwellMs: card.dwellMs,
      slotMap: card.slotMap,
    })),
    scenes: scenes.map((scene: SceneDoc) => ({
      name: scene.name,
      cardIds: scene.cardIds,
      enabled: scene.enabled,
    })),
    rules: rules.map((rule: RuleDoc) => ({
      name: rule.name,
      condition: rule.condition,
      kind: rule.action.kind,
      priority: rule.priority,
      enabled: rule.enabled,
    })),
  });

  const bytecodeHash = await sha256Hex(bytecode);
  const bytecodeBlob = new Blob([Uint8Array.from(bytecode)], { type: "application/json" });
  const storageId = await ctx.storage.store(bytecodeBlob, {
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
};

export const compileAndDeploy = dashboardAction({
  args: {
    cardIds: v.array(v.id("cards")),
    deviceId: v.id("devices"),
  },
  returns: v.object({
    etag: v.string(),
    size: v.number(),
    warnings: v.array(diagnosticValidator),
  }),
  handler: compileAndDeployHandler,
});

export const manifest = internalQuery({
  args: {
    deviceId: v.id("devices"),
  },
  returns: v.object({
    programVersion: v.number(),
    etag: v.string(),
    bytecodeUrl: v.string(),
    bytecodeSha256: v.string(),
    assetBundleSha256: v.string(),
    scenes: v.array(sceneValidator),
    rules: v.array(ruleValidator),
  }),
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    const cards = await ctx.db.query("cards").collect();
    const storageId = getLatestCompiledStorageId(cards);
    if (!storageId) {
      throw new Error("No compiled program available");
    }

    const bytecodeUrl = await ctx.storage.getUrl(storageId);
    if (!bytecodeUrl) {
      throw new Error("Compiled program blob missing");
    }

    const scenes = await ctx.db.query("scenes").collect();
    const rules = await ctx.db.query("rules").collect();

    return {
      programVersion: device.programVersion,
      etag: device.programEtag,
      bytecodeUrl,
      bytecodeSha256: stripEtag(device.programEtag) ?? device.programEtag,
      assetBundleSha256: stripEtag(device.programEtag) ?? device.programEtag,
      scenes,
      rules,
    };
  },
});

export const dataFrame = internalQuery({
  args: {
    deviceId: v.id("devices"),
    nowMs: v.number(),
  },
  returns: v.object({
    v: v.number(),
    t: v.number(),
    s: v.any(),
    a: v.any(),
    meta: v.any(),
  }),
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    const allCards = await ctx.db.query("cards").collect();
    const deployedStorageId = getLatestCompiledStorageId(allCards);
    const cards = allCards.filter(
      (card) => card.enabled && card.compiledStorageId && card.compiledStorageId === deployedStorageId,
    );
    const slotMap = buildGlobalSlotMap(cards);
    const sources = await ctx.db.query("sources").collect();
    const latestTelemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_device_time", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .first();

    const sourceData: Record<string, Record<string, unknown>> = Object.fromEntries(
      sources.map((source) => [source.sourceId, asRecord(source.data) ?? {}]),
    );
    sourceData.device = {
      name: device.name,
      fwVersion: device.fwVersion,
      programVersion: device.programVersion,
      online: device.online,
      lastSeen: device.lastSeen,
    };
    sourceData.telemetry = latestTelemetry
      ? {
          rssi: latestTelemetry.rssi,
          heapFree: latestTelemetry.heapFree,
          brightness: latestTelemetry.brightness,
          lux: latestTelemetry.lux,
          tempC: latestTelemetry.tempC,
          humidity: latestTelemetry.humidity,
          estAmps: latestTelemetry.estAmps,
          governorActive: latestTelemetry.governorActive,
        }
      : {};

    const fetchedAtBySource = new Map(sources.map((source) => [source.sourceId, source.fetchedAt]));
    fetchedAtBySource.set("device", device.lastSeen);
    fetchedAtBySource.set("telemetry", latestTelemetry?.at ?? device.lastSeen);

    const slots: Record<string, unknown> = {};
    const ages: Record<string, number> = {};
    for (const slot of slotMap) {
      slots[String(slot.index)] = getByPath(sourceData, slot.path);
      ages[String(slot.index)] = fetchedAtBySource.get(slot.sourceId) ?? device.lastSeen;
    }

    return {
      v: device.dataVersion,
      t: Math.floor(args.nowMs / 1000),
      s: slots,
      a: ages,
      meta: {
        activeSceneId: device.activeSceneId ?? null,
        pinnedCardId: device.pinnedUntil && device.pinnedUntil > args.nowMs ? device.pinnedCardId ?? null : null,
        pinnedUntil: device.pinnedUntil ?? null,
        cardCount: cards.length,
      },
    };
  },
});

export const deployedCards = internalQuery({
  args: {},
  returns: v.array(cardValidator),
  handler: async (ctx) => {
    const cards = await ctx.db.query("cards").collect();
    const storageId = getLatestCompiledStorageId(cards);
    if (!storageId) {
      return [];
    }
    return cards.filter((card) => card.compiledStorageId === storageId);
  },
});
