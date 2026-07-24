import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { cardValidator } from "./cards";
import { stripEtag } from "./lib/etag";
import { ruleValidator } from "./rules";
import { sceneValidator } from "./scenes";

type SlotEntry = {
  index: number;
  path: string;
  type: string;
  sourceId: string;
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

    const storageId = device.programStorageId;
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

    const cards = (await ctx.db.query("cards").collect()).filter((card) => card.enabled);
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
        pinnedCardId:
          device.pinnedUntil && device.pinnedUntil > args.nowMs ? (device.pinnedCardId ?? null) : null,
        pinnedUntil: device.pinnedUntil ?? null,
        cardCount: cards.length,
        programStorageId: device.programStorageId ?? null,
      },
    };
  },
});

export const deployedCards = internalQuery({
  args: {},
  returns: v.array(cardValidator),
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").collect();
    const storageIds = new Set(
      devices
        .map((device) => device.programStorageId)
        .filter((id): id is Id<"_storage"> => id !== undefined),
    );
    if (storageIds.size === 0) {
      return [];
    }
    const cards = await ctx.db.query("cards").collect();
    return cards.filter(
      (card): card is Doc<"cards"> =>
        card.compiledStorageId !== undefined && storageIds.has(card.compiledStorageId),
    );
  },
});
