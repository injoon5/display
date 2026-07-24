import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const telemetryValidator = v.object({
  _id: v.id("telemetry"),
  _creationTime: v.number(),
  deviceId: v.id("devices"),
  at: v.number(),
  rssi: v.number(),
  heapFree: v.number(),
  brightness: v.number(),
  lux: v.number(),
  tempC: v.number(),
  humidity: v.number(),
  presenceRoom: v.boolean(),
  presenceBed: v.boolean(),
  estAmps: v.number(),
  governorActive: v.boolean(),
  lastError: v.optional(v.string()),
});

export const record = internalMutation({
  args: {
    deviceId: v.id("devices"),
    fw: v.string(),
    programVersion: v.optional(v.number()),
    uptime: v.optional(v.number()),
    rssi: v.number(),
    heapFree: v.number(),
    psramFree: v.optional(v.number()),
    brightness: v.number(),
    lux: v.number(),
    tempC: v.number(),
    humidity: v.number(),
    presenceRoom: v.boolean(),
    presenceBed: v.boolean(),
    estAmps: v.number(),
    governorActive: v.boolean(),
    lastError: v.optional(v.string()),
  },
  returns: telemetryValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    const at = Date.now();
    const telemetryId = await ctx.db.insert("telemetry", {
      deviceId: args.deviceId,
      at,
      rssi: args.rssi,
      heapFree: args.heapFree,
      brightness: args.brightness,
      lux: args.lux,
      tempC: args.tempC,
      humidity: args.humidity,
      presenceRoom: args.presenceRoom,
      presenceBed: args.presenceBed,
      estAmps: args.estAmps,
      governorActive: args.governorActive,
      lastError: args.lastError,
    });

    await ctx.db.patch("devices", args.deviceId, {
      fwVersion: args.fw,
      online: true,
      lastSeen: at,
    });

    const saved = await ctx.db.get("telemetry", telemetryId);
    if (!saved) {
      throw new Error("Telemetry record failed");
    }
    return saved;
  },
});

export const prune = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const devices = await ctx.db.query("devices").collect();
    let deleted = 0;

    for (const device of devices) {
      const expired = await ctx.db
        .query("telemetry")
        .withIndex("by_device_time", (q) => q.eq("deviceId", device._id).lt("at", cutoff))
        .collect();

      for (const item of expired) {
        deleted += 1;
        await ctx.db.delete("telemetry", item._id);
      }
    }

    return { deleted };
  },
});
