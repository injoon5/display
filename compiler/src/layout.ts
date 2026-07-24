import type { AttributeValue, CardNode, MxmlNode, TemplatePart } from "./ast.js";
import type { Expr } from "./expr.js";
import { FONT_METRICS, measureText } from "./fonts.js";
import { inferExpressionType, typeName, type TypecheckContext } from "./typecheck.js";
import type { Diagnostic, Span } from "./types.js";

export interface LiteralOrExpr<T> {
  expr?: Expr;
  value?: T;
}

export interface TextDrawable {
  color: LiteralOrExpr<string>;
  font: string;
  kind: "text";
  span: Span;
  template: TemplatePart[];
  x: number;
  y: number;
}

export interface RectDrawable {
  color: LiteralOrExpr<string>;
  h: number;
  kind: "frect" | "line" | "pixel" | "rect" | "stroke";
  span: Span;
  w: number;
  x: number;
  x2?: number;
  y: number;
  y2?: number;
}

export interface BarDrawable {
  bg: LiteralOrExpr<string>;
  color: LiteralOrExpr<string>;
  h: number;
  kind: "bar";
  max: LiteralOrExpr<number>;
  span: Span;
  value: LiteralOrExpr<number>;
  w: number;
  x: number;
  y: number;
}

export interface IconDrawable {
  asset: string;
  color?: LiteralOrExpr<string>;
  kind: "icon";
  span: Span;
  x: number;
  y: number;
}

export interface MarqueeDrawable {
  color: LiteralOrExpr<string>;
  font: string;
  kind: "marquee";
  span: Span;
  speed: number;
  template: TemplatePart[];
  w: number;
  x: number;
  y: number;
}

export interface FxDrawable {
  arg: number;
  color: LiteralOrExpr<string>;
  fx: number;
  h: number;
  kind: "fx";
  span: Span;
  w: number;
  x: number;
  y: number;
}

export interface GroupNode {
  blinkRateMs?: number;
  children: RenderNode[];
  kind: "group";
  span: Span;
  test?: Expr;
}

export type DrawNode = BarDrawable | FxDrawable | IconDrawable | MarqueeDrawable | RectDrawable | TextDrawable;
export type RenderNode = DrawNode | GroupNode;

export interface LayoutResult {
  diagnostics: Diagnostic[];
  nodes: RenderNode[];
  show?: Expr;
  stale?: { afterMs: number; style: string };
}

function literalValue(attrs: Record<string, AttributeValue>, name: string): string | null {
  const value = attrs[name];
  if (!value) {
    return null;
  }
  return value.kind === "literal" ? value.value : null;
}

function exprValue(attrs: Record<string, AttributeValue>, name: string): Expr | null {
  const value = attrs[name];
  if (!value) {
    return null;
  }
  return value.kind === "expression" ? value.expr : null;
}

function parseInteger(attrs: Record<string, AttributeValue>, name: string, span: Span, diagnostics: Diagnostic[], fallback?: number): number | null {
  const value = attrs[name];
  if (!value) {
    return fallback ?? null;
  }
  if (value.kind !== "literal") {
    diagnostics.push({
      code: "layout.literal-required",
      message: `Attribute '${name}' must be a literal in Stage 1`,
      severity: "error",
      span: value.span
    });
    return null;
  }
  const parsed = Number.parseInt(value.value, 10);
  if (Number.isNaN(parsed)) {
    diagnostics.push({
      code: "layout.invalid-int",
      message: `Attribute '${name}' must be an integer`,
      severity: "error",
      span
    });
    return null;
  }
  return parsed;
}

export function parseDuration(value: string): number | null {
  const match = value.trim().match(/^(\d+)(ms|s|m|h)$/);
  if (!match) {
    return null;
  }
  const amount = Number.parseInt(match[1], 10);
  switch (match[2]) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60_000;
    case "h":
      return amount * 3_600_000;
    default:
      return null;
  }
}

function colorValue(attrs: Record<string, AttributeValue>, name: string, fallback: string): LiteralOrExpr<string> {
  const literal = literalValue(attrs, name);
  if (literal) {
    return { value: literal };
  }
  const expr = exprValue(attrs, name);
  return expr ? { expr } : { value: fallback };
}

function numberValue(attrs: Record<string, AttributeValue>, name: string, fallback: number): LiteralOrExpr<number> {
  const literal = literalValue(attrs, name);
  if (literal !== null) {
    return { value: Number(literal) };
  }
  const expr = exprValue(attrs, name);
  return expr ? { expr } : { value: fallback };
}

function estimateTypeLength(typeNameValue: string): number {
  switch (typeNameValue) {
    case "bool":
      return 5;
    case "color":
      return 7;
    case "float":
      return 8;
    case "int":
      return 6;
    case "null":
      return 0;
    case "string":
      return 10;
    default:
      return 10;
  }
}

function literalNumber(expr: Expr | undefined): number | null {
  return expr?.kind === "literal" && typeof expr.value === "number" ? expr.value : null;
}

function estimateExpressionLength(expr: Expr, typeContext: TypecheckContext): number {
  switch (expr.kind) {
    case "literal":
      if (expr.value === null) {
        return 0;
      }
      if (typeof expr.value === "string") {
        return expr.value.length;
      }
      if (typeof expr.value === "number") {
        return String(expr.value).length;
      }
      return expr.value ? 4 : 5;
    case "path":
    case "unary":
    case "binary":
      return estimateTypeLength(typeName(inferExpressionType(expr, typeContext)));
    case "ternary":
      return Math.max(
        estimateExpressionLength(expr.consequent, typeContext),
        estimateExpressionLength(expr.alternate, typeContext)
      );
    case "filter": {
      switch (expr.name) {
        case "pad":
          return literalNumber(expr.args[0]) ?? 2;
        case "trunc":
          return literalNumber(expr.args[0]) ?? 8;
        case "hhmm":
          return 5;
        case "hhmmss":
          return 8;
        case "date":
          return 10;
        case "duration":
          return 6;
        case "relative":
          return 5;
        case "icon_for":
          return 12;
        case "default":
          return Math.max(
            estimateExpressionLength(expr.input, typeContext),
            expr.args[0] ? estimateExpressionLength(expr.args[0], typeContext) : 0
          );
        case "upper":
        case "lower":
        case "comma":
        case "fixed":
        case "round":
        case "floor":
        case "ceil":
        case "abs":
          return estimateExpressionLength(expr.input, typeContext);
        default:
          return estimateTypeLength(typeName(inferExpressionType(expr, typeContext)));
      }
    }
    default: {
      const exhaustive: never = expr;
      return exhaustive;
    }
  }
}

function estimatedTemplateText(parts: TemplatePart[], font: string, typeContext: TypecheckContext): { h: number; w: number } {
  let width = 0;
  const height = FONT_METRICS[font as keyof typeof FONT_METRICS]?.glyphHeight ?? 7;
  for (const part of parts) {
    if (part.kind === "literal") {
      width += measureText(font, part.value).width;
      continue;
    }
    width += estimateExpressionLength(part.expr, typeContext) * (FONT_METRICS[font as keyof typeof FONT_METRICS]?.advance ?? 6);
  }
  return { h: height, w: width };
}

function layoutNode(node: MxmlNode, diagnostics: Diagnostic[], typeContext: TypecheckContext): RenderNode[] {
  if (node.tagName === "source" || node.tagName === "show" || node.tagName === "stale") {
    return [];
  }

  if (node.tagName === "row" || node.tagName === "col" || node.tagName === "box" || node.tagName === "spacer") {
    diagnostics.push({
      code: "layout.unsupported-container",
      message: `Stage 1 only supports absolute layout; <${node.tagName}> is not implemented`,
      severity: "error",
      span: node.span
    });
    return [];
  }

  if (node.tagName === "when") {
    return [
      {
        children: node.children.flatMap((child) => layoutNode(child, diagnostics, typeContext)),
        kind: "group",
        span: node.span,
        test: exprValue(node.attrs, "test") ?? undefined
      }
    ];
  }

  if (node.tagName === "blink") {
    const rateRaw = literalValue(node.attrs, "rate") ?? "600ms";
    const blinkRateMs = parseDuration(rateRaw);
    if (blinkRateMs === null) {
      diagnostics.push({
        code: "layout.invalid-duration",
        message: `Invalid blink rate '${rateRaw}'`,
        severity: "error",
        span: node.span
      });
    }
    return [
      {
        blinkRateMs: blinkRateMs ?? 600,
        children: node.children.flatMap((child) => layoutNode(child, diagnostics, typeContext)),
        kind: "group",
        span: node.span
      }
    ];
  }

  if (node.tagName === "text") {
    const x = parseInteger(node.attrs, "x", node.span, diagnostics);
    const y = parseInteger(node.attrs, "y", node.span, diagnostics);
    if (x === null || y === null) {
      return [];
    }
    return [
      {
        color: colorValue(node.attrs, "color", "#ffffff"),
        font: literalValue(node.attrs, "font") ?? "5x7",
        kind: "text",
        span: node.span,
        template: node.template,
        x,
        y
      }
    ];
  }

  if (node.tagName === "badge") {
    const x = parseInteger(node.attrs, "x", node.span, diagnostics);
    const y = parseInteger(node.attrs, "y", node.span, diagnostics);
    if (x === null || y === null) {
      return [];
    }
    const font = literalValue(node.attrs, "font") ?? "3x5";
    const pad = parseInteger(node.attrs, "pad", node.span, diagnostics, 1) ?? 1;
    const size = estimatedTemplateText(node.template ?? [], font, typeContext);
    return [
      {
        color: colorValue(node.attrs, "bg", "#000000"),
        h: size.h + pad * 2,
        kind: "frect",
        span: node.span,
        w: size.w + pad * 2,
        x,
        y
      },
      {
        color: colorValue(node.attrs, "fg", "#ffffff"),
        font,
        kind: "text",
        span: node.span,
        template: node.template ?? [],
        x: x + pad,
        y: y + pad
      }
    ];
  }

  if (node.tagName === "bar") {
    const x = parseInteger(node.attrs, "x", node.span, diagnostics);
    const y = parseInteger(node.attrs, "y", node.span, diagnostics);
    const w = parseInteger(node.attrs, "w", node.span, diagnostics);
    const h = parseInteger(node.attrs, "h", node.span, diagnostics);
    if (x === null || y === null || w === null || h === null) {
      return [];
    }
    return [
      {
        bg: colorValue(node.attrs, "bg", "#202020"),
        color: colorValue(node.attrs, "color", "#33cc66"),
        h,
        kind: "bar",
        max: numberValue(node.attrs, "max", 1),
        span: node.span,
        value: numberValue(node.attrs, "value", 0),
        w,
        x,
        y
      }
    ];
  }

  if (node.tagName === "icon") {
    const x = parseInteger(node.attrs, "x", node.span, diagnostics);
    const y = parseInteger(node.attrs, "y", node.span, diagnostics);
    if (x === null || y === null) {
      return [];
    }
    return [
      {
        asset: literalValue(node.attrs, "src") ?? "icon:missing",
        color: exprValue(node.attrs, "color") || literalValue(node.attrs, "color") ? colorValue(node.attrs, "color", "#ffffff") : undefined,
        kind: "icon",
        span: node.span,
        x,
        y
      }
    ];
  }

  if (node.tagName === "marquee") {
    const x = parseInteger(node.attrs, "x", node.span, diagnostics);
    const y = parseInteger(node.attrs, "y", node.span, diagnostics);
    const w = parseInteger(node.attrs, "w", node.span, diagnostics, 64) ?? 64;
    if (x === null || y === null) {
      return [];
    }
    return [
      {
        color: colorValue(node.attrs, "color", "#f0f0f0"),
        font: literalValue(node.attrs, "font") ?? "5x7",
        kind: "marquee",
        span: node.span,
        speed: parseInteger(node.attrs, "speed", node.span, diagnostics, 18) ?? 18,
        template: node.template ?? [],
        w,
        x,
        y
      }
    ];
  }

  if (node.tagName === "fx") {
    const kinds: Record<string, number> = { starfield: 0, warp: 0, matrix: 1, fire: 2, fireplace: 2, life: 3, conway: 3, flow: 4, rain: 5, vu: 6, moon: 7, grass: 8, graph: 9, wxicon: 10 };
    const kindName = literalValue(node.attrs, "kind") ?? "starfield";
    const fx = kinds[kindName] ?? 0;
    return [
      {
        arg: parseInteger(node.attrs, "arg", node.span, diagnostics, 0) ?? 0,
        color: colorValue(node.attrs, "color", "#8fb8ff"),
        fx,
        h: parseInteger(node.attrs, "h", node.span, diagnostics, 32) ?? 32,
        kind: "fx",
        span: node.span,
        w: parseInteger(node.attrs, "w", node.span, diagnostics, 64) ?? 64,
        x: parseInteger(node.attrs, "x", node.span, diagnostics, 0) ?? 0,
        y: parseInteger(node.attrs, "y", node.span, diagnostics, 0) ?? 0
      }
    ];
  }

  const x = parseInteger(node.attrs, "x", node.span, diagnostics, node.tagName === "stroke" ? 0 : undefined);
  const y = parseInteger(node.attrs, "y", node.span, diagnostics, node.tagName === "stroke" ? 0 : undefined);
  if (x === null || y === null) {
    return [];
  }

  switch (node.tagName) {
    case "rect":
    case "frect":
    case "stroke": {
      const w = parseInteger(node.attrs, "w", node.span, diagnostics, node.tagName === "stroke" ? 64 : undefined);
      const h = parseInteger(node.attrs, "h", node.span, diagnostics, node.tagName === "stroke" ? 32 : undefined);
      if (w === null || h === null) {
        return [];
      }
      return [{ color: colorValue(node.attrs, "color", "#ffffff"), h, kind: node.tagName, span: node.span, w, x, y }];
    }
    case "line": {
      const x2 = parseInteger(node.attrs, "x2", node.span, diagnostics);
      const y2 = parseInteger(node.attrs, "y2", node.span, diagnostics);
      if (x2 === null || y2 === null) {
        return [];
      }
      return [{ color: colorValue(node.attrs, "color", "#ffffff"), h: 0, kind: "line", span: node.span, w: 0, x, x2, y, y2 }];
    }
    case "pixel":
      return [{ color: colorValue(node.attrs, "color", "#ffffff"), h: 1, kind: "pixel", span: node.span, w: 1, x, y }];
    default:
      return [];
  }
}

export function layoutCard(card: CardNode, typeContext: TypecheckContext): LayoutResult {
  const diagnostics: Diagnostic[] = [];
  const nodes = card.children.flatMap((child) => layoutNode(child, diagnostics, typeContext));
  const show = exprValue(card.children.find((child) => child.tagName === "show")?.attrs ?? {}, "when") ?? undefined;
  const staleNode = card.children.find((child) => child.tagName === "stale");
  let stale: LayoutResult["stale"];
  if (staleNode) {
    const after = literalValue(staleNode.attrs, "after");
    const afterMs = after ? parseDuration(after) : null;
    if (afterMs === null) {
      diagnostics.push({
        code: "layout.invalid-stale",
        message: "Invalid <stale after> duration",
        severity: "error",
        span: staleNode.span
      });
    } else {
      stale = { afterMs, style: literalValue(staleNode.attrs, "style") ?? "dim" };
    }
  }
  return { diagnostics, nodes, show, stale };
}
