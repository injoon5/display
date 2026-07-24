import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { dashboardMutation, dashboardQuery } from "./auth";
import { bumpAllDevicesDataEtag, deviceValidator } from "./devices";

export const sceneValidator = v.object({
  _id: v.id("scenes"),
  _creationTime: v.number(),
  name: v.string(),
  cardIds: v.array(v.id("cards")),
  schedule: v.optional(v.string()),
  brightnessCeiling: v.optional(v.number()),
  homekitIdentifier: v.number(),
  enabled: v.boolean(),
});

function formatKstTime(now: number): {
  weekday: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(now));

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { weekday, hour, minute };
}

function parseClock(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function scheduleApplies(schedule: string, now: number): boolean {
  const [scope, span] = schedule.trim().split(/\s+/, 2);
  if (!scope || !span) {
    return false;
  }

  const [startRaw, endRaw] = span.split("-", 2);
  if (!startRaw || !endRaw) {
    return false;
  }

  const start = parseClock(startRaw);
  const end = parseClock(endRaw);
  if (start === null || end === null) {
    return false;
  }

  const current = formatKstTime(now);
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(current.weekday);
  const isWeekend = ["Sat", "Sun"].includes(current.weekday);
  const matchesScope =
    scope === "everyday" ||
    (scope === "weekday" && isWeekday) ||
    (scope === "weekend" && isWeekend);

  if (!matchesScope) {
    return false;
  }

  const minuteOfDay = current.hour * 60 + current.minute;
  return minuteOfDay >= start && minuteOfDay <= end;
}

export const list = dashboardQuery({
  args: {},
  returns: v.array(sceneValidator),
  handler: async (ctx) => {
    const scenes = await ctx.db.query("scenes").take(100);
    return scenes.sort((left, right) => left.homekitIdentifier - right.homekitIdentifier);
  },
});

export const listInternal = internalQuery({
  args: {},
  returns: v.array(sceneValidator),
  handler: async (ctx) => {
    const scenes = await ctx.db.query("scenes").take(100);
    return scenes.sort((left, right) => left.homekitIdentifier - right.homekitIdentifier);
  },
});

export const get = dashboardQuery({
  args: { sceneId: v.id("scenes") },
  returns: v.union(sceneValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("scenes", args.sceneId);
  },
});

export const save = dashboardMutation({
  args: {
    sceneId: v.optional(v.id("scenes")),
    name: v.string(),
    cardIds: v.array(v.id("cards")),
    schedule: v.optional(v.string()),
    brightnessCeiling: v.optional(v.number()),
    homekitIdentifier: v.number(),
    enabled: v.optional(v.boolean()),
  },
  returns: sceneValidator,
  handler: async (ctx, args) => {
    const sceneInput = {
      name: args.name,
      cardIds: args.cardIds,
      schedule: args.schedule,
      brightnessCeiling: args.brightnessCeiling,
      homekitIdentifier: args.homekitIdentifier,
      enabled: args.enabled ?? true,
    };

    const sceneId = args.sceneId ?? (await ctx.db.insert("scenes", sceneInput));
    if (args.sceneId) {
      await ctx.db.patch("scenes", args.sceneId, sceneInput);
    }

    const saved = await ctx.db.get("scenes", sceneId);
    if (!saved) {
      throw new Error("Scene save failed");
    }

    await bumpAllDevicesDataEtag(ctx, "scene-save");
    return saved;
  },
});

export const remove = dashboardMutation({
  args: { sceneId: v.id("scenes") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const scene = await ctx.db.get("scenes", args.sceneId);
    if (!scene) {
      return { deleted: false };
    }

    await ctx.db.delete("scenes", args.sceneId);
    await bumpAllDevicesDataEtag(ctx, "scene-remove");
    return { deleted: true };
  },
});

export const activate = dashboardMutation({
  args: {
    deviceId: v.id("devices"),
    sceneId: v.id("scenes"),
  },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }
    const scene = await ctx.db.get("scenes", args.sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      activeSceneId: args.sceneId,
      pinnedCardId: undefined,
      pinnedUntil: undefined,
    });
    await bumpAllDevicesDataEtag(ctx, "scene-activate");

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Scene activation failed");
    }
    return updated;
  },
});

export const activateInternal = internalMutation({
  args: {
    deviceId: v.id("devices"),
    sceneId: v.id("scenes"),
  },
  returns: deviceValidator,
  handler: async (ctx, args) => {
    const device = await ctx.db.get("devices", args.deviceId);
    if (!device) {
      throw new Error("Device not found");
    }
    const scene = await ctx.db.get("scenes", args.sceneId);
    if (!scene) {
      throw new Error("Scene not found");
    }

    await ctx.db.patch("devices", args.deviceId, {
      activeSceneId: args.sceneId,
      pinnedCardId: undefined,
      pinnedUntil: undefined,
    });
    await bumpAllDevicesDataEtag(ctx, "scene-activate-internal");

    const updated = await ctx.db.get("devices", args.deviceId);
    if (!updated) {
      throw new Error("Scene activation failed");
    }
    return updated;
  },
});

export const applySchedule = internalMutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const scenes = await ctx.db.query("scenes").collect();
    const activeScheduledScene = scenes.find((scene) => scene.enabled && scene.schedule && scheduleApplies(scene.schedule, now));
    if (!activeScheduledScene) {
      return { updated: 0 };
    }

    const devices = await ctx.db.query("devices").collect();
    let updated = 0;
    for (const device of devices) {
      if (device.activeSceneId !== activeScheduledScene._id) {
        updated += 1;
        await ctx.db.patch("devices", device._id, {
          activeSceneId: activeScheduledScene._id,
        });
      }
    }

    if (updated > 0) {
      await bumpAllDevicesDataEtag(ctx, "scene-schedule");
    }

    return { updated };
  },
});
