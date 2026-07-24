import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { dashboardMutation, dashboardQuery } from "./auth";
import { bumpAllDevicesDataEtag } from "./devices";

const ruleActionValidator = v.object({
  kind: v.string(),
  cardId: v.optional(v.id("cards")),
  sceneId: v.optional(v.id("scenes")),
  durationMs: v.optional(v.number()),
  value: v.optional(v.number()),
});

export const ruleValidator = v.object({
  _id: v.id("rules"),
  _creationTime: v.number(),
  name: v.string(),
  condition: v.string(),
  action: ruleActionValidator,
  priority: v.number(),
  enabled: v.boolean(),
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

function splitExpression(expression: string, separator: "or" | "and"): string[] {
  const parts = expression.split(new RegExp(`\\s+${separator}\\s+`, "i"));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseLiteral(rawValue: string): string | number | boolean | null {
  const trimmed = rawValue.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null") {
    return null;
  }
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith("\"") && trimmed.endsWith("\""))) {
    return trimmed.slice(1, -1);
  }
  const asNumber = Number(trimmed);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }
  return trimmed;
}

function lookupValue(context: Record<string, unknown>, path: string): unknown {
  if (!path.includes(".")) {
    return context[path];
  }

  const parts = path.split(".");
  let current: unknown = context;
  for (const part of parts) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[part];
  }
  return current ?? null;
}

function compareValues(left: unknown, operator: string, right: unknown): boolean {
  switch (operator) {
    case "==":
      return left === right;
    case "!=":
      return left !== right;
    case "<":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "<=":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case ">":
      return typeof left === "number" && typeof right === "number" && left > right;
    case ">=":
      return typeof left === "number" && typeof right === "number" && left >= right;
    default: {
      const exhaustiveCheck: never = operator as never;
      void exhaustiveCheck;
      return false;
    }
  }
}

function evaluateAtom(expression: string, context: Record<string, unknown>): boolean {
  const trimmed = expression.trim();
  if (trimmed.startsWith("not ")) {
    return !evaluateAtom(trimmed.slice(4), context);
  }

  const comparison = trimmed.match(/^([a-zA-Z0-9_.-]+)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
  if (comparison) {
    const leftPath = comparison[1];
    const operator = comparison[2];
    const rightRaw = comparison[3];
    if (!leftPath || !operator || !rightRaw) {
      return false;
    }
    const left = lookupValue(context, leftPath);
    const right = parseLiteral(rightRaw);
    return compareValues(left, operator, right);
  }

  return Boolean(lookupValue(context, trimmed));
}

function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  return splitExpression(condition, "or").some((orPart) =>
    splitExpression(orPart, "and").every((andPart) => evaluateAtom(andPart, context)),
  );
}

export const list = dashboardQuery({
  args: {},
  returns: v.array(ruleValidator),
  handler: async (ctx) => {
    const rules = await ctx.db.query("rules").collect();
    return rules.sort((left, right) => right.priority - left.priority);
  },
});

export const get = dashboardQuery({
  args: { ruleId: v.id("rules") },
  returns: v.union(ruleValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get("rules", args.ruleId);
  },
});

export const save = dashboardMutation({
  args: {
    ruleId: v.optional(v.id("rules")),
    name: v.string(),
    condition: v.string(),
    action: ruleActionValidator,
    priority: v.number(),
    enabled: v.optional(v.boolean()),
  },
  returns: ruleValidator,
  handler: async (ctx, args) => {
    const ruleInput = {
      name: args.name,
      condition: args.condition,
      action: args.action,
      priority: args.priority,
      enabled: args.enabled ?? true,
    };

    const ruleId = args.ruleId ?? (await ctx.db.insert("rules", ruleInput));
    if (args.ruleId) {
      await ctx.db.patch("rules", args.ruleId, ruleInput);
    }

    const saved = await ctx.db.get("rules", ruleId);
    if (!saved) {
      throw new Error("Rule save failed");
    }
    await bumpAllDevicesDataEtag(ctx, "rule-save");
    return saved;
  },
});

export const remove = dashboardMutation({
  args: { ruleId: v.id("rules") },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const rule = await ctx.db.get("rules", args.ruleId);
    if (!rule) {
      return { deleted: false };
    }

    await ctx.db.delete("rules", args.ruleId);
    await bumpAllDevicesDataEtag(ctx, "rule-remove");
    return { deleted: true };
  },
});

export const evaluate = internalMutation({
  args: {},
  returns: v.object({ matched: v.number(), updated: v.number() }),
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").collect();
    const rules = (await ctx.db.query("rules").collect())
      .filter((rule) => rule.enabled)
      .sort((left, right) => right.priority - left.priority);
    const scenes = await ctx.db.query("scenes").collect();
    const sceneNames = new Map(scenes.map((scene) => [scene._id, scene.name]));
    const sources = await ctx.db.query("sources").collect();
    const sourceData = Object.fromEntries(sources.map((source) => [source.sourceId, asRecord(source.data) ?? {}]));

    const now = Date.now();
    const kst = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(now));
    const hour = Number(kst.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(kst.find((part) => part.type === "minute")?.value ?? "0");
    const weekday = kst.find((part) => part.type === "weekday")?.value ?? "Mon";

    let matched = 0;
    let updated = 0;

    for (const device of devices) {
      if (device.pinnedUntil && device.pinnedUntil <= now) {
        updated += 1;
        await ctx.db.patch("devices", device._id, {
          pinnedCardId: undefined,
          pinnedUntil: undefined,
        });
      }

      const context: Record<string, unknown> = {
        ...sourceData,
        time: { hour, minute, weekday },
        scene: device.activeSceneId ? (sceneNames.get(device.activeSceneId) ?? null) : null,
        device: {
          online: device.online,
          fwVersion: device.fwVersion,
        },
      };

      const activeRule = rules.find((rule) => evaluateCondition(rule.condition, context));
      if (!activeRule) {
        continue;
      }
      matched += 1;

      switch (activeRule.action.kind) {
        case "pin":
        case "interrupt": {
          if (!activeRule.action.cardId) {
            break;
          }
          updated += 1;
          await ctx.db.patch("devices", device._id, {
            pinnedCardId: activeRule.action.cardId,
            pinnedUntil: now + (activeRule.action.durationMs ?? 60_000),
          });
          break;
        }
        case "scene": {
          if (!activeRule.action.sceneId || device.activeSceneId === activeRule.action.sceneId) {
            break;
          }
          updated += 1;
          await ctx.db.patch("devices", device._id, {
            activeSceneId: activeRule.action.sceneId,
            pinnedCardId: undefined,
            pinnedUntil: undefined,
          });
          break;
        }
        case "sleep": {
          if (!device.pinnedCardId && !device.pinnedUntil) {
            break;
          }
          updated += 1;
          await ctx.db.patch("devices", device._id, {
            pinnedCardId: undefined,
            pinnedUntil: undefined,
          });
          break;
        }
        case "brightness":
          break;
        default: {
          const exhaustiveCheck: never = activeRule.action.kind as never;
          void exhaustiveCheck;
        }
      }
    }

    if (updated > 0) {
      await bumpAllDevicesDataEtag(ctx, "rule-evaluate");
    }

    return { matched, updated };
  },
});
