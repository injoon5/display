import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { dashboardMutation, dashboardQuery } from "./auth";
import { bumpAllDevicesDataEtag } from "./devices";

export const sourceValidator = v.object({
  _id: v.id("sources"),
  _creationTime: v.number(),
  sourceId: v.string(),
  kind: v.string(),
  config: v.any(),
  intervalMs: v.number(),
  origin: v.union(v.literal("convex"), v.literal("oracle-icn")),
  data: v.any(),
  fetchedAt: v.number(),
  error: v.optional(v.string()),
  consecutiveFailures: v.number(),
  circuitOpenUntil: v.optional(v.number()),
});

const originValidator = v.union(v.literal("convex"), v.literal("oracle-icn"));

const writeArgs = {
  sourceId: v.string(),
  kind: v.string(),
  config: v.any(),
  intervalMs: v.number(),
  origin: originValidator,
  data: v.any(),
  fetchedAt: v.optional(v.number()),
};

type WriteArgs = {
  sourceId: string;
  kind: string;
  config: unknown;
  intervalMs: number;
  origin: "convex" | "oracle-icn";
  data: unknown;
  fetchedAt?: number;
};

function buildDummyPayload(sourceId: string): Record<string, unknown> | null {
  switch (sourceId) {
    case "spotify":
      return {
        isPlaying: true,
        track: "Seoul",
        artist: "Balming Tiger",
        album: "January Never Dies",
        progressMs: 87_000,
        durationMs: 214_000,
        playedAt: "2026-07-24T13:20:00+09:00",
      };
    case "calendar":
      return {
        next: {
          title: "Gangnam dentist check-up",
          startsAt: "2026-07-24T18:30:00+09:00",
          location: "Yeoksam-daero 122",
          countdownMin: 42,
        },
        countToday: 2,
      };
    case "github":
      return {
        repo: "injoon5/display",
        openPullRequests: 2,
        failingChecks: 0,
        assignedToMe: 1,
        latest: "feat(convex): schema, device HTTP API, crons, seed",
      };
    case "fx":
      return {
        usdKrw: 1384.2,
        jpyKrw100: 942.7,
        eurKrw: 1498.6,
        asOf: "2026-07-24T13:20:00+09:00",
      };
    default:
      return null;
  }
}

async function writeSource(ctx: MutationCtx, args: WriteArgs) {
  const existing = await ctx.db
    .query("sources")
    .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
    .unique();

  const sourceInput = {
    sourceId: args.sourceId,
    kind: args.kind,
    config: args.config,
    intervalMs: args.intervalMs,
    origin: args.origin,
    data: args.data,
    fetchedAt: args.fetchedAt ?? Date.now(),
    error: undefined,
    consecutiveFailures: 0,
    circuitOpenUntil: undefined,
  };

  const sourceId = existing?._id ?? (await ctx.db.insert("sources", sourceInput));
  if (existing) {
    await ctx.db.patch("sources", existing._id, sourceInput);
  }

  await bumpAllDevicesDataEtag(ctx, `source-write:${args.sourceId}`);
  await ctx.scheduler.runAfter(0, internal.rules.evaluate, {});

  const saved = await ctx.db.get("sources", sourceId);
  if (!saved) {
    throw new Error("Source write failed");
  }
  return saved;
}

export const getAll = dashboardQuery({
  args: {},
  returns: v.array(sourceValidator),
  handler: async (ctx) => {
    const sources = await ctx.db.query("sources").take(200);
    return sources.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  },
});

export const getBySourceIdInternal = internalQuery({
  args: { sourceId: v.string() },
  returns: v.union(sourceValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
      .unique();
  },
});

export const write = dashboardMutation({
  args: writeArgs,
  returns: sourceValidator,
  handler: async (ctx, args) => {
    return await writeSource(ctx, args);
  },
});

export const writeInternal = internalMutation({
  args: writeArgs,
  returns: sourceValidator,
  handler: async (ctx, args) => {
    return await writeSource(ctx, args);
  },
});

export const writeError = dashboardMutation({
  args: {
    sourceId: v.string(),
    kind: v.optional(v.string()),
    config: v.optional(v.any()),
    intervalMs: v.optional(v.number()),
    origin: v.optional(originValidator),
    error: v.string(),
  },
  returns: sourceValidator,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", args.sourceId))
      .unique();

    const consecutiveFailures = (existing?.consecutiveFailures ?? 0) + 1;
    const sourceInput = {
      sourceId: args.sourceId,
      kind: args.kind ?? existing?.kind ?? "unknown",
      config: args.config ?? existing?.config ?? {},
      intervalMs: args.intervalMs ?? existing?.intervalMs ?? 60_000,
      origin: args.origin ?? existing?.origin ?? "convex",
      data: existing?.data ?? {},
      fetchedAt: existing?.fetchedAt ?? Date.now(),
      error: args.error,
      consecutiveFailures,
      circuitOpenUntil: consecutiveFailures >= 5 ? Date.now() + 5 * 60 * 1000 : undefined,
    };

    const sourceId = existing?._id ?? (await ctx.db.insert("sources", sourceInput));
    if (existing) {
      await ctx.db.patch("sources", existing._id, sourceInput);
    }

    await bumpAllDevicesDataEtag(ctx, `source-error:${args.sourceId}`);

    const saved = await ctx.db.get("sources", sourceId);
    if (!saved) {
      throw new Error("Source error write failed");
    }
    return saved;
  },
});

export const fetchOne = internalAction({
  args: { id: v.string() },
  returns: v.object({
    sourceId: v.string(),
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(internal.sources.getBySourceIdInternal, {
      sourceId: args.id,
    });

    if (existing?.circuitOpenUntil && existing.circuitOpenUntil > Date.now()) {
      return { sourceId: args.id, ok: false };
    }

    const payload = buildDummyPayload(args.id);
    if (!payload) {
      return { sourceId: args.id, ok: false };
    }

    if (!existing) {
      await ctx.runMutation(internal.sources.writeInternal, {
        sourceId: args.id,
        kind: args.id,
        config: {},
        intervalMs: 60_000,
        origin: "convex",
        data: payload,
      });
      return { sourceId: args.id, ok: true };
    }

    await ctx.runMutation(internal.sources.writeInternal, {
      sourceId: existing.sourceId,
      kind: existing.kind,
      config: existing.config,
      intervalMs: existing.intervalMs,
      origin: existing.origin,
      data: payload,
    });
    return { sourceId: args.id, ok: true };
  },
});
