import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { dashboardMutation, dashboardQuery } from "./auth";

export const slotMapEntryValidator = v.object({
  index: v.number(),
  path: v.string(),
  type: v.string(),
  sourceId: v.string(),
});

export const diagnosticValidator = v.object({
  severity: v.string(),
  message: v.string(),
  line: v.number(),
  col: v.number(),
});

export const cardValidator = v.object({
  _id: v.id("cards"),
  _creationTime: v.number(),
  slug: v.string(),
  name: v.string(),
  source: v.string(),
  compiledStorageId: v.optional(v.id("_storage")),
  slotMap: v.array(slotMapEntryValidator),
  sourceRefs: v.array(v.string()),
  diagnostics: v.array(diagnosticValidator),
  estimatedAmps: v.number(),
  enabled: v.boolean(),
  priority: v.number(),
  dwellMs: v.number(),
  updatedAt: v.number(),
});

export type CardArtifacts = {
  sourceRefs: string[];
  slotMap: Array<{
    index: number;
    path: string;
    type: string;
    sourceId: string;
  }>;
  diagnostics: Array<{
    severity: string;
    message: string;
    line: number;
    col: number;
  }>;
};

type StageZeroElement = {
  bind?: unknown;
  type?: unknown;
};

type StageZeroCard = {
  elements?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStageZeroElement(value: unknown): value is StageZeroElement {
  return isObject(value);
}

function isStageZeroCard(value: unknown): value is StageZeroCard {
  return isObject(value);
}

function inferSlotType(path: string, declaredType: unknown): string {
  if (typeof declaredType === "string" && declaredType.length > 0) {
    return declaredType;
  }
  if (path.endsWith("_min") || path.endsWith("tempC") || path.endsWith("humidity")) {
    return "number";
  }
  if (path.endsWith("active") || path.endsWith("online") || path.endsWith("alert")) {
    return "boolean";
  }
  return "unknown";
}

export function extractCardArtifacts(source: string): CardArtifacts {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return {
      sourceRefs: [],
      slotMap: [],
      diagnostics: [{ severity: "error", message, line: 1, col: 1 }],
    };
  }

  if (!isStageZeroCard(parsed) || !Array.isArray(parsed.elements)) {
    return {
      sourceRefs: [],
      slotMap: [],
      diagnostics: [
        {
          severity: "error",
          message: "Stage 0 card must be a JSON object with an elements array",
          line: 1,
          col: 1,
        },
      ],
    };
  }

  const sourceRefs = new Set<string>();
  const slotMap: CardArtifacts["slotMap"] = [];
  const diagnostics: CardArtifacts["diagnostics"] = [];
  const seenPaths = new Set<string>();

  for (const element of parsed.elements) {
    if (!isStageZeroElement(element) || typeof element.bind !== "string") {
      continue;
    }

    const bind = element.bind.trim();
    if (!/^[a-z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(bind)) {
      diagnostics.push({
        severity: "warning",
        message: `Skipped unsupported bind path "${bind}"`,
        line: 1,
        col: 1,
      });
      continue;
    }

    if (seenPaths.has(bind)) {
      continue;
    }

    const sourceId = bind.split(".")[0];
    if (!sourceId) {
      continue;
    }

    seenPaths.add(bind);
    sourceRefs.add(sourceId);
    slotMap.push({
      index: slotMap.length,
      path: bind,
      type: inferSlotType(bind, element.type),
      sourceId,
    });
  }

  return {
    sourceRefs: [...sourceRefs],
    slotMap,
    diagnostics,
  };
}

export function buildCardDocument(
  existing: Pick<Doc<"cards">, "compiledStorageId" | "source"> | null,
  input: {
    slug: string;
    name: string;
    source: string;
    estimatedAmps?: number;
    enabled?: boolean;
    priority?: number;
    dwellMs?: number;
  },
): Omit<Doc<"cards">, "_id" | "_creationTime"> {
  const artifacts = extractCardArtifacts(input.source);
  return {
    slug: input.slug,
    name: input.name,
    source: input.source,
    compiledStorageId: existing?.source === input.source ? existing.compiledStorageId : undefined,
    slotMap: artifacts.slotMap,
    sourceRefs: artifacts.sourceRefs,
    diagnostics: artifacts.diagnostics,
    estimatedAmps: input.estimatedAmps ?? 0.85,
    enabled: input.enabled ?? true,
    priority: input.priority ?? 50,
    dwellMs: input.dwellMs ?? 10_000,
    updatedAt: Date.now(),
  };
}

export const list = dashboardQuery({
  args: {},
  returns: v.array(cardValidator),
  handler: async (ctx) => {
    const cards = await ctx.db.query("cards").collect();
    return cards.sort((left, right) => left.slug.localeCompare(right.slug));
  },
});

export const getBySlug = dashboardQuery({
  args: { slug: v.string() },
  returns: v.union(cardValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cards")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getBySlugInternal = internalQuery({
  args: { slug: v.string() },
  returns: v.union(cardValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cards")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const save = dashboardMutation({
  args: {
    cardId: v.optional(v.id("cards")),
    slug: v.string(),
    name: v.string(),
    source: v.string(),
    estimatedAmps: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
    priority: v.optional(v.number()),
    dwellMs: v.optional(v.number()),
    slotMap: v.optional(v.array(slotMapEntryValidator)),
    diagnostics: v.optional(v.array(diagnosticValidator)),
    sourceRefs: v.optional(v.array(v.string())),
  },
  returns: cardValidator,
  handler: async (ctx, args) => {
    const existing = args.cardId
      ? await ctx.db.get("cards", args.cardId)
      : await ctx.db.query("cards").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    const cardDocument = buildCardDocument(existing, args);

    // Prefer artifacts from the shared browser/Node compiler when provided.
    if (args.slotMap) {
      cardDocument.slotMap = args.slotMap;
    }
    if (args.diagnostics) {
      cardDocument.diagnostics = args.diagnostics;
    }
    if (args.sourceRefs) {
      cardDocument.sourceRefs = args.sourceRefs;
    }

    const cardId = existing?._id ?? (await ctx.db.insert("cards", cardDocument));
    if (existing) {
      await ctx.db.patch("cards", existing._id, cardDocument);
    }

    const saved = await ctx.db.get("cards", cardId);
    if (!saved) {
      throw new Error("Card save failed");
    }
    return saved;
  },
});

export const deploy = dashboardMutation({
  args: { cardId: v.id("cards") },
  returns: v.object({
    cardId: v.id("cards"),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const card = await ctx.db.get("cards", args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }
    if (!card.compiledStorageId) {
      throw new Error("Card has not been compiled yet");
    }

    const latestVersion = await ctx.db
      .query("cardVersions")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .order("desc")
      .first();
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    await ctx.db.insert("cardVersions", {
      cardId: args.cardId,
      version: nextVersion,
      source: card.source,
      compiledStorageId: card.compiledStorageId,
      deployedAt: Date.now(),
    });

    return {
      cardId: args.cardId,
      version: nextVersion,
    };
  },
});

export const getMany = internalQuery({
  args: { ids: v.array(v.id("cards")) },
  returns: v.array(cardValidator),
  handler: async (ctx, args) => {
    const cards = await Promise.all(args.ids.map((id) => ctx.db.get("cards", id)));
    return cards.filter((card): card is Doc<"cards"> => card !== null);
  },
});

export const patchCompiledArtifacts = internalMutation({
  args: {
    cardId: v.id("cards"),
    slotMap: v.array(slotMapEntryValidator),
    diagnostics: v.array(diagnosticValidator),
    estimatedAmps: v.number(),
    sourceRefs: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const card = await ctx.db.get("cards", args.cardId);
    if (!card) {
      throw new Error("Card not found");
    }
    await ctx.db.patch("cards", args.cardId, {
      slotMap: args.slotMap,
      diagnostics: args.diagnostics,
      estimatedAmps: args.estimatedAmps,
      sourceRefs: args.sourceRefs,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listEnabled = internalQuery({
  args: {},
  returns: v.array(cardValidator),
  handler: async (ctx) => {
    const cards = await ctx.db.query("cards").take(200);
    return cards.filter((card) => card.enabled);
  },
});
