import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { dashboardMutation, dashboardQuery, hashToken } from "./auth";
import { sha256Hex, toEtag } from "./lib/etag";

const fwChannelValidator = v.union(v.literal("dev"), v.literal("stable"));

export const deviceValidator = v.object({
  _id: v.id("devices"),
  _creationTime: v.number(),
  name: v.string(),
  tokenHash: v.string(),
  programVersion: v.number(),
  programEtag: v.string(),
  programStorageId: v.optional(v.id("_storage")),
  playlistCardIds: v.optional(v.array(v.id("cards"))),
  playlistCardId: v.optional(v.id("cards")),
  dataVersion: v.number(),
  dataEtag: v.string(),
  activeSceneId: v.optional(v.id("scenes")),
  pinnedCardId: v.optional(v.id("cards")),
  pinnedUntil: v.optional(v.number()),
  brightnessCeiling: v.optional(v.number()),
  fwVersion: v.string(),
  fwChannel: fwChannelValidator,
  online: v.boolean(),
  lastSeen: v.number(),
});

async function buildSeedEtag(kind: "program" | "data"): Promise<string> {
  return toEtag(await sha256Hex(`${kind}:0`));
}

export async function bumpAllDevicesDataEtag(
  ctx: GenericMutationCtx<DataModel>,
  reason: string,
): Promise<number> {
  const devices = await ctx.db.query("devices").collect();
  const now = Date.now();
  let updated = 0;
  for (const device of devices) {
    updated += 1;
    await ctx.db.patch("devices", device._id, {
      dataVersion: device.dataVersion + 1,
      dataEtag: toEtag(await sha256Hex(`${device._id}:${reason}:${device.dataVersion + 1}:${now}`)),
    });
  }
  return updated;
}

export async function bumpDeviceProgramEtag(
  ctx: GenericMutationCtx<DataModel>,
  deviceId: Id<"devices">,
  bytecodeHash: string,
): Promise<Doc<"devices">> {
  const device = await ctx.db.get("devices", deviceId);
  if (!device) {
    throw new Error("Device not found");
  }

  await ctx.db.patch("devices", deviceId, {
    programVersion: device.programVersion + 1,
    programEtag: toEtag(bytecodeHash),
  });

  const updated = await ctx.db.get("devices", deviceId);
  if (!updated) {
    throw new Error("Device not found after program update");
  }
  return updated;
}

export const list = dashboardQuery({
  args: {},
  returns: v.array(deviceValidator),
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").take(100);
    return devices.sort((left, right) => right.lastSeen - left.lastSeen);
  },
});

export const listInternal = internalQuery({
  args: {},
  returns: v.array(deviceValidator),
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").take(100);
    return devices.sort((left, right) => right.lastSeen - left.lastSeen);
  },
});

export const get = dashboardQuery({
  args: { id: v.id("devices") },
  returns: v.union(deviceValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("devices", args.id);
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("devices") },
  returns: v.union(deviceValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("devices", args.id);
  },
});

export const getByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(deviceValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_token", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
  },
});

export const register = dashboardMutation({
  args: {
    name: v.string(),
    token: v.string(),
    fwVersion: v.string(),
    fwChannel: fwChannelValidator,
  },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const tokenHash = await hashToken(args.token);
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch("devices", existing._id, {
        name: args.name,
        fwVersion: args.fwVersion,
        fwChannel: args.fwChannel,
        online: true,
        lastSeen: now,
      });
      const updated = await ctx.db.get("devices", existing._id);
      if (!updated) {
        throw new Error("Device register failed");
      }
      return updated;
    }

    const deviceId = await ctx.db.insert("devices", {
      name: args.name,
      tokenHash,
      programVersion: 0,
      programEtag: await buildSeedEtag("program"),
      dataVersion: 0,
      dataEtag: await buildSeedEtag("data"),
      fwVersion: args.fwVersion,
      fwChannel: args.fwChannel,
      online: true,
      lastSeen: now,
    });

    const created = await ctx.db.get("devices", deviceId);
    if (!created) {
      throw new Error("Device register failed");
    }
    return created;
  },
});

export const claim = dashboardMutation({
  args: {
    deviceId: v.id("devices"),
    token: v.string(),
    name: v.optional(v.string()),
  },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      name: args.name ?? device.name,
      tokenHash: await hashToken(args.token),
      lastSeen: Date.now(),
    });

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Device claim failed");
    }
    return updated;
  },
});

export const pin = dashboardMutation({
  args: {
    deviceId: v.id("devices"),
    cardId: v.id("cards"),
    durationMs: v.optional(v.number()),
  },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }
    const card = await ctx.db.get("cards", args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      pinnedCardId: args.cardId,
      pinnedUntil: Date.now() + (args.durationMs ?? 60_000),
    });
    await bumpAllDevicesDataEtag(ctx, "pin-card");

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Pin update failed");
    }
    return updated;
  },
});

export const unpin = dashboardMutation({
  args: { deviceId: v.id("devices") },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      pinnedCardId: undefined,
      pinnedUntil: undefined,
    });
    await bumpAllDevicesDataEtag(ctx, "clear-pin");

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Clear pin failed");
    }
    return updated;
  },
});

export const pinCard = internalMutation({
  args: {
    deviceId: v.id("devices"),
    cardId: v.id("cards"),
    durationMs: v.number(),
  },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      pinnedCardId: args.cardId,
      pinnedUntil: Date.now() + args.durationMs,
    });
    await bumpAllDevicesDataEtag(ctx, "pin-card");

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Pin update failed");
    }
    return updated;
  },
});

export const clearPin = internalMutation({
  args: { deviceId: v.id("devices") },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      pinnedCardId: undefined,
      pinnedUntil: undefined,
    });
    await bumpAllDevicesDataEtag(ctx, "clear-pin");

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Pin clear failed");
    }
    return updated;
  },
});

export const applyProgramDeployment = internalMutation({
  args: {
    deviceId: v.id("devices"),
    cardIds: v.array(v.id("cards")),
    primaryCardId: v.id("cards"),
    cardStorage: v.array(
      v.object({
        cardId: v.id("cards"),
        storageId: v.id("_storage"),
        bytecodeHash: v.string(),
      }),
    ),
    storageId: v.id("_storage"),
    bytecodeHash: v.string(),
  },
  returns: v.object({
    deviceId: v.id("devices"),
    programVersion: v.number(),
  }),
  handler: async (ctx, args) => {
    const storageByCard = new Map(
      args.cardStorage.map((entry) => [entry.cardId, entry] as const),
    );

    for (const cardId of args.cardIds) {
      const entry = storageByCard.get(cardId);
      if (!entry) {
        continue;
      }
      const card = await ctx.db.get("cards", cardId);
      if (!card) {
        continue;
      }

      await ctx.db.patch("cards", cardId, {
        compiledStorageId: entry.storageId,
      });

      const versions = await ctx.db
        .query("cardVersions")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      const nextVersion =
        versions.reduce((maxVersion, version) => Math.max(maxVersion, version.version), 0) + 1;

      await ctx.db.insert("cardVersions", {
        cardId,
        version: nextVersion,
        source: card.source,
        compiledStorageId: entry.storageId,
        deployedAt: Date.now(),
      });
    }

    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      programVersion: device.programVersion + 1,
      programEtag: toEtag(args.bytecodeHash),
      programStorageId: args.storageId,
      playlistCardIds: args.cardIds,
      playlistCardId: args.primaryCardId,
    });

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Device not found after program update");
    }
    return {
      deviceId: updated._id,
      programVersion: updated.programVersion,
    };
  },
});

function pickPlaylistCardId(
  cardIds: Id<"cards">[],
  cardsById: Map<Id<"cards">, Doc<"cards">>,
  nowMs: number,
  pinnedCardId: Id<"cards"> | undefined,
  pinnedUntil: number | undefined,
): Id<"cards"> | null {
  if (pinnedCardId && pinnedUntil && pinnedUntil > nowMs && cardsById.has(pinnedCardId)) {
    return pinnedCardId;
  }
  const ordered = cardIds
    .map((id) => cardsById.get(id))
    .filter((card): card is Doc<"cards"> => card !== undefined && card.enabled);
  if (ordered.length === 0) {
    return null;
  }
  const totalDwell = ordered.reduce((sum, card) => sum + Math.max(1_000, card.dwellMs), 0);
  let offset = nowMs % totalDwell;
  for (const card of ordered) {
    const dwell = Math.max(1_000, card.dwellMs);
    if (offset < dwell) {
      return card._id;
    }
    offset -= dwell;
  }
  return ordered[0]!._id;
}

export const rotatePlaylist = internalMutation({
  args: {},
  returns: v.object({ rotated: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const devices = await ctx.db.query("devices").collect();
    let rotated = 0;

    for (const device of devices) {
      let playlistIds = device.playlistCardIds ?? [];
      if (playlistIds.length === 0 && device.activeSceneId) {
        const scene = await ctx.db.get("scenes", device.activeSceneId);
        playlistIds = scene?.cardIds ?? [];
      }
      if (playlistIds.length === 0) {
        continue;
      }

      const cards = await Promise.all(playlistIds.map((id) => ctx.db.get("cards", id)));
      const cardsById = new Map(
        cards
          .filter((card): card is Doc<"cards"> => card !== null)
          .map((card) => [card._id, card] as const),
      );

      const nextCardId = pickPlaylistCardId(
        playlistIds,
        cardsById,
        now,
        device.pinnedCardId,
        device.pinnedUntil,
      );
      if (!nextCardId) {
        continue;
      }

      const nextCard = cardsById.get(nextCardId);
      if (!nextCard?.compiledStorageId) {
        continue;
      }

      const scene = device.activeSceneId ? await ctx.db.get("scenes", device.activeSceneId) : null;
      const brightnessCeiling = scene?.brightnessCeiling ?? device.brightnessCeiling;

      if (
        device.playlistCardId === nextCardId &&
        device.programStorageId === nextCard.compiledStorageId &&
        device.brightnessCeiling === brightnessCeiling
      ) {
        continue;
      }

      const hashSource = `${nextCard.compiledStorageId}:${nextCard.updatedAt}:${nextCardId}`;
      rotated += 1;
      await ctx.db.patch("devices", device._id, {
        playlistCardId: nextCardId,
        programStorageId: nextCard.compiledStorageId,
        programVersion: device.programVersion + 1,
        programEtag: toEtag(await sha256Hex(hashSource)),
        brightnessCeiling,
      });
    }

    return { rotated };
  },
});

export const markStale = internalMutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - 90_000;
    const devices = await ctx.db.query("devices").collect();
    let updated = 0;

    for (const device of devices) {
      if (device.online && device.lastSeen < cutoff) {
        updated += 1;
        await ctx.db.patch("devices", device._id, { online: false });
      }
    }

    return { updated };
  },
});
