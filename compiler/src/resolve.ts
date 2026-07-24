import { z, ZodBoolean, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodString } from "zod";

import type { AttributeValue, CardNode } from "./ast.js";
import type { Diagnostic, SourceDefinition, Span, TypeInfo } from "./types.js";
import { ambientScopeSchema, sourcePlugins } from "./sources/index.js";

export interface ResolveContext {
  diagnostics: Diagnostic[];
  sources: SourceDefinition[];
  sourceKinds: Map<string, string>;
}

function attributeLiteral(attrs: Record<string, AttributeValue>, name: string): string | null {
  const value = attrs[name];
  if (!value) {
    return null;
  }
  if (value.kind !== "literal") {
    return null;
  }
  return value.value;
}

function typeFromSchema(schema: z.ZodTypeAny): TypeInfo {
  if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
    const inner = typeFromSchema(schema.unwrap() as z.ZodTypeAny);
    return { ...inner, nullable: true };
  }
  if (schema instanceof ZodObject) {
    const fields: Record<string, TypeInfo> = {};
    for (const [key, value] of Object.entries(schema.shape)) {
      fields[key] = typeFromSchema(value);
    }
    return { fields, kind: "object", nullable: false };
  }
  if (schema instanceof ZodNumber) {
    const checks = schema.safeParse(1.5).success;
    return { kind: checks ? "float" : "int", nullable: false };
  }
  if (schema instanceof ZodString) {
    return { kind: "string", nullable: false };
  }
  if (schema instanceof ZodBoolean) {
    return { kind: "bool", nullable: false };
  }
  return { kind: "unknown", nullable: false };
}

function rootAmbientType(): TypeInfo {
  return typeFromSchema(ambientScopeSchema);
}

function rootSourceType(kind: string): TypeInfo | null {
  const plugin = sourcePlugins[kind];
  if (!plugin) {
    return null;
  }
  return typeFromSchema(plugin.schema);
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

function nearest(value: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score = levenshtein(value, candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore <= 3 ? best : null;
}

export function resolveCard(card: CardNode): ResolveContext {
  const diagnostics: Diagnostic[] = [];
  const sources: SourceDefinition[] = [];
  const sourceKinds = new Map<string, string>();

  for (const child of card.children) {
    if (child.tagName !== "source") {
      continue;
    }
    const id = attributeLiteral(child.attrs, "id");
    const kind = attributeLiteral(child.attrs, "kind");
    if (!id || !kind) {
      diagnostics.push({
        code: "source.invalid",
        message: "<source> requires literal id and kind attributes",
        severity: "error",
        span: child.span
      });
      continue;
    }
    if (!sourcePlugins[kind]) {
      diagnostics.push({
        code: "source.unknown-kind",
        hint: nearest(kind, Object.keys(sourcePlugins)) ?? undefined,
        message: `Unknown source kind '${kind}'`,
        severity: "error",
        span: child.span
      });
      continue;
    }
    sourceKinds.set(id, kind);
    const attrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(child.attrs)) {
      if (value.kind === "literal") {
        attrs[key] = value.value;
      }
    }
    sources.push({ attrs, id, kind, span: child.span });
  }

  return { diagnostics, sourceKinds, sources };
}

export function resolvePathType(path: string[], context: ResolveContext, span?: Span): TypeInfo | null {
  const ambient = rootAmbientType();
  let type: TypeInfo | undefined;
  let fields: string[] = [];

  if (context.sourceKinds.has(path[0])) {
    const sourceKind = context.sourceKinds.get(path[0]);
    const sourceType = sourceKind ? rootSourceType(sourceKind) : null;
    if (!sourceType) {
      return null;
    }
    type = sourceType;
    fields = Object.keys(type.fields ?? {});
    for (const segment of path.slice(1)) {
      if (!type.fields?.[segment]) {
        const hint = nearest(segment, fields);
        context.diagnostics.push({
          code: "path.unknown-field",
          hint: hint ? `Did you mean '${hint}'?` : undefined,
          message: `Unknown field '${segment}' on source '${path[0]}'`,
          severity: "error",
          span
        });
        return null;
      }
      type = type.fields[segment];
      fields = Object.keys(type.fields ?? {});
    }
    return type;
  }

  type = ambient;
  fields = Object.keys(type.fields ?? {});
  for (const segment of path) {
    if (!type.fields?.[segment]) {
      const sourceHint = nearest(segment, [...context.sourceKinds.keys(), ...fields]);
      context.diagnostics.push({
        code: "path.unknown-root",
        hint: sourceHint ? `Did you mean '${sourceHint}'?` : undefined,
        message: `Unknown path '${path.join(".")}'`,
        severity: "error",
        span
      });
      return null;
    }
    type = type.fields[segment];
    fields = Object.keys(type.fields ?? {});
  }
  return type;
}
