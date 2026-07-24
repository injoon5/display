import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { dashboardMutation, dashboardQuery } from "./auth";
import { bumpAllDevicesDataEtag } from "./devices";

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

/** Dashboard-only sensor simulation for local emulation / HomeKit mirrors. */
export const simulate = dashboardMutation({
  args: {
    deviceId: v.id("devices"),
    brightness: v.optional(v.number()),
    lux: v.optional(v.number()),
    presenceRoom: v.optional(v.boolean()),
    presenceBed: v.optional(v.boolean()),
    estAmps: v.optional(v.number()),
  },
  returns: telemetryValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    const latest = await ctx.db
      .query("telemetry")
      .withIndex("by_device_time", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .first();

    const at = Date.now();
    const telemetryId = await ctx.db.insert("telemetry", {
      deviceId: args.deviceId,
      at,
      rssi: latest?.rssi ?? -50,
      heapFree: latest?.heapFree ?? 180_000,
      brightness: args.brightness ?? latest?.brightness ?? 48,
      lux: args.lux ?? latest?.lux ?? 120,
      tempC: latest?.tempC ?? 36.5,
      humidity: latest?.humidity ?? 41,
      presenceRoom: args.presenceRoom ?? latest?.presenceRoom ?? false,
      presenceBed: args.presenceBed ?? latest?.presenceBed ?? false,
      estAmps: args.estAmps ?? latest?.estAmps ?? 0.6,
      governorActive: latest?.governorActive ?? false,
      lastError: latest?.lastError,
    });

    await ctx.db.patch("devices", args.deviceId, {
      online: true,
      lastSeen: at,
    });
    await bumpAllDevicesDataEtag(ctx, "telemetry-simulate");

    const saved = await ctx.db.get("telemetry", telemetryId);
    if (!saved) {
      throw new Error("Telemetry simulate failed");
    }
    return saved;
  },
});

export const latest = dashboardQuery({
  args: {},
  returns: v.union(telemetryValidator, v.null()),
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").take(50);
    const device = devices.sort((left, right) => right.lastSeen - left.lastSeen)[0];
    if (!device) {
      return null;
    }

    return await ctx.db
      .query("telemetry")
      .withIndex("by_device_time", (q) => q.eq("deviceId", device._id))
      .order("desc")
      .first();
  },
});

export const prune = internalMutation({
  args: {},
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const devices = await ctx.db.query("devices").take(50);
    let deleted = 0;

    for (const device of devices) {
      const expired = await ctx.db
        .query("telemetry")
        .withIndex("by_device_time", (q) => q.eq("deviceId", device._id).lt("at", cutoff))
        .take(100);

      for (const item of expired) {
        deleted += 1;
        await ctx.db.delete("telemetry", item._id);
      }
    }

    return { deleted };
  },
});
