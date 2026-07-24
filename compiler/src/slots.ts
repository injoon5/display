import { evaluateExpression, parseExpression } from "./expr.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Plain dotted lookup — no expression / filter evaluation. */
export function getByPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }
    current = record[part];
  }
  return current ?? null;
}

function looksLikeExpression(path: string): boolean {
  return /[|?:()<>=!]/.test(path) || path.includes(" ") || path.includes('"') || path.includes("'");
}

function renderTemplate(template: string, scope: Record<string, unknown>): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const start = template.indexOf("{{", i);
    if (start < 0) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, start);
    const end = template.indexOf("}}", start + 2);
    if (end < 0) {
      out += template.slice(start);
      break;
    }
    const exprSrc = template.slice(start + 2, end).trim();
    try {
      const value = evaluateExpression(parseExpression(exprSrc), scope);
      out += value == null ? "" : String(value);
    } catch {
      // Missing / invalid expr → empty fragment (matches VM empty-string draw).
    }
    i = end + 2;
  }
  return out;
}

/**
 * Resolve a compiler slotMap path against a runtime scope.
 * Handles plain paths, filter expressions (`now.hhmm | default("00:00")`),
 * and multi-part templates (`template:{{bus.eta_min}}'`).
 */
export function resolveSlotValue(scope: Record<string, unknown>, path: string): unknown {
  if (path.startsWith("template:")) {
    return renderTemplate(path.slice("template:".length), scope);
  }
  if (!looksLikeExpression(path)) {
    return getByPath(scope, path);
  }
  try {
    return evaluateExpression(parseExpression(path), scope);
  } catch {
    return null;
  }
}
