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
  dataVersion: v.number(),
  dataEtag: v.string(),
  activeSceneId: v.optional(v.id("scenes")),
  pinnedCardId: v.optional(v.id("cards")),
  pinnedUntil: v.optional(v.number()),
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
    const devices = await ctx.db.query("devices").collect();
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
    storageId: v.id("_storage"),
    bytecodeHash: v.string(),
  },
  returns: v.object({
    deviceId: v.id("devices"),
    programVersion: v.number(),
  }),
  handler: async (ctx, args) => {
    const selectedCardIds = new Set(args.cardIds);
    const allCards = await ctx.db.query("cards").collect();

    for (const card of allCards) {
      if (selectedCardIds.has(card._id)) {
        await ctx.db.patch("cards", card._id, {
          compiledStorageId: args.storageId,
        });

        const versions = await ctx.db
          .query("cardVersions")
          .withIndex("by_card", (q) => q.eq("cardId", card._id))
          .collect();
        const nextVersion = versions.reduce((maxVersion, version) => Math.max(maxVersion, version.version), 0) + 1;

        await ctx.db.insert("cardVersions", {
          cardId: card._id,
          version: nextVersion,
          source: card.source,
          compiledStorageId: args.storageId,
          deployedAt: Date.now(),
        });
      } else if (card.compiledStorageId) {
        await ctx.db.patch("cards", card._id, {
          compiledStorageId: undefined,
        });
      }
    }

    const device = await bumpDeviceProgramEtag(ctx, args.deviceId, args.bytecodeHash);
    return {
      deviceId: device._id,
      programVersion: device.programVersion,
    };
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
