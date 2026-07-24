import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { cardValidator } from "./cards";
import { stripEtag } from "./lib/etag";
import { buildRuntimeScope, getByPath } from "./lib/runtimeScope";
import { ruleValidator } from "./rules";
import { sceneValidator } from "./scenes";

type SlotEntry = {
  index: number;
  path: string;
  type: string;
  sourceId: string;
};

function indoorFetchedAt(sources: Array<{ sourceId: string; fetchedAt: number }>): number | undefined {
  return sources.find((source) => source.sourceId === "indoor")?.fetchedAt;
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

    const cards = (await ctx.db.query("cards").take(200)).filter((card) => card.enabled);
    const slotMap = buildGlobalSlotMap(cards);
    const sources = await ctx.db.query("sources").take(200);
    const latestTelemetry = await ctx.db
      .query("telemetry")
      .withIndex("by_device_time", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .first();

    const activeScene = device.activeSceneId ? await ctx.db.get("scenes", device.activeSceneId) : null;
    const sourceData = buildRuntimeScope({
      device: {
        fwVersion: device.fwVersion,
        lastSeen: device.lastSeen,
        name: device.name,
        online: device.online,
        programVersion: device.programVersion,
      },
      nowMs: args.nowMs,
      sceneName: activeScene?.name ?? null,
      sources: sources.map((source) => ({
        data: source.data,
        fetchedAt: source.fetchedAt,
        sourceId: source.sourceId,
      })),
      telemetry: latestTelemetry
        ? {
            brightness: latestTelemetry.brightness,
            estAmps: latestTelemetry.estAmps,
            governorActive: latestTelemetry.governorActive,
            heapFree: latestTelemetry.heapFree,
            humidity: latestTelemetry.humidity,
            lux: latestTelemetry.lux,
            presenceBed: latestTelemetry.presenceBed,
            presenceRoom: latestTelemetry.presenceRoom,
            rssi: latestTelemetry.rssi,
            tempC: latestTelemetry.tempC,
          }
        : null,
      uptimeSeconds: Math.max(0, Math.floor((args.nowMs - device._creationTime) / 1000)),
    });

    const fetchedAtBySource = new Map(sources.map((source) => [source.sourceId, source.fetchedAt]));
    fetchedAtBySource.set("device", device.lastSeen);
    fetchedAtBySource.set("telemetry", latestTelemetry?.at ?? device.lastSeen);
    fetchedAtBySource.set("now", args.nowMs);
    fetchedAtBySource.set("time", args.nowMs);
    fetchedAtBySource.set("room", indoorFetchedAt(sources) ?? latestTelemetry?.at ?? device.lastSeen);
    fetchedAtBySource.set("ambient", args.nowMs);

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
