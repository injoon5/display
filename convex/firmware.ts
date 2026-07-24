import { v } from "convex/values";
import { dashboardMutation, dashboardQuery } from "./auth";

export const firmwareValidator = v.object({
  _id: v.id("firmware"),
  _creationTime: v.number(),
  version: v.string(),
  channel: v.string(),
  r2Url: v.string(),
  sha256: v.string(),
  signature: v.string(),
  releasedAt: v.number(),
});

export const list = dashboardQuery({
  args: { channel: v.optional(v.string()) },
  returns: v.array(firmwareValidator),
  handler: async (ctx, args) => {
    const channel = args.channel;
    if (channel) {
      const releases = await ctx.db
        .query("firmware")
        .withIndex("by_channel", (q) => q.eq("channel", channel))
        .collect();
      return releases.sort((left, right) => right.releasedAt - left.releasedAt);
    }

    const releases = await ctx.db.query("firmware").collect();
    return releases.sort((left, right) => right.releasedAt - left.releasedAt);
  },
});

export const publish = dashboardMutation({
  args: {
    version: v.string(),
    channel: v.string(),
    r2Url: v.string(),
    sha256: v.string(),
    signature: v.string(),
  },
  returns: firmwareValidator,
  handler: async (ctx, args) => {
    const releaseId = await ctx.db.insert("firmware", {
      version: args.version,
      channel: args.channel,
      r2Url: args.r2Url,
      sha256: args.sha256,
      signature: args.signature,
      releasedAt: Date.now(),
    });

    const release = await ctx.db.get("firmware", releaseId);
    if (!release) {
      throw new Error("Firmware publish failed");
    }
    return release;
  },
});
