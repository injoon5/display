import type { TemplatePart } from "./ast.js";
import type { Expr } from "./expr.js";
import { measureText } from "./fonts.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SLOT_COUNT, type Diagnostic } from "./types.js";
import type { DrawNode, LayoutResult, RenderNode, TextDrawable } from "./layout.js";

function overflowDiagnostics(message: string, span: DrawNode["span"]): Diagnostic {
  return {
    code: "layout.overflow",
    message,
    severity: "error",
    span
  };
}

function literalNumber(expr: Expr | undefined): number | null {
  return expr?.kind === "literal" && typeof expr.value === "number" ? expr.value : null;
}

function estimateExpressionLength(expr: Expr): number {
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
      return 6;
    case "ternary":
      return Math.max(estimateExpressionLength(expr.consequent), estimateExpressionLength(expr.alternate));
    case "filter":
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
            estimateExpressionLength(expr.input),
            expr.args[0] ? estimateExpressionLength(expr.args[0]) : 0
          );
        case "upper":
        case "lower":
        case "comma":
        case "fixed":
          return estimateExpressionLength(expr.input);
        default:
          return 10;
      }
    default: {
      const exhaustive: never = expr;
      return exhaustive;
    }
  }
}

function templateSample(parts: TemplatePart[]): string {
  return parts
    .map((part) => {
      if (part.kind === "literal") {
        return part.value;
      }
      return "0".repeat(Math.max(0, estimateExpressionLength(part.expr)));
    })
    .join("");
}

function estimateTextBounds(node: TextDrawable): { h: number; w: number } {
  const text = templateSample(node.template);
  const measured = measureText(node.font, text);
  return { h: measured.height, w: measured.width };
}

function validateNode(node: RenderNode, diagnostics: Diagnostic[]): void {
  if (node.kind === "group") {
    for (const child of node.children) {
      validateNode(child, diagnostics);
    }
    return;
  }

  switch (node.kind) {
    case "text": {
      const { w, h } = estimateTextBounds(node);
      if (node.x < 0 || node.y < 0 || node.x + w > CANVAS_WIDTH || node.y + h > CANVAS_HEIGHT) {
        diagnostics.push(overflowDiagnostics(`text overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
      }
      return;
    }
    case "icon":
      if (node.x < 0 || node.y < 0 || node.x + 8 > CANVAS_WIDTH || node.y + 8 > CANVAS_HEIGHT) {
        diagnostics.push(overflowDiagnostics(`icon overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
      }
      return;
    case "line":
      if (
        node.x < 0 ||
        node.y < 0 ||
        (node.x2 ?? 0) < 0 ||
        (node.y2 ?? 0) < 0 ||
        node.x >= CANVAS_WIDTH ||
        node.y >= CANVAS_HEIGHT ||
        (node.x2 ?? 0) >= CANVAS_WIDTH ||
        (node.y2 ?? 0) >= CANVAS_HEIGHT
      ) {
        diagnostics.push(overflowDiagnostics(`line overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
      }
      return;
    default:
      if (node.x < 0 || node.y < 0 || node.x + node.w > CANVAS_WIDTH || node.y + node.h > CANVAS_HEIGHT) {
        diagnostics.push(overflowDiagnostics(`${node.kind} overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
      }
  }
}

export function validateLayout(layout: LayoutResult, slotCount: number): Diagnostic[] {
  const diagnostics: Diagnostic[] = [...layout.diagnostics];
  for (const node of layout.nodes) {
    validateNode(node, diagnostics);
  }
  if (slotCount > MAX_SLOT_COUNT) {
    diagnostics.push({
      code: "slot.overflow",
      message: `slot count ${slotCount} exceeds ${MAX_SLOT_COUNT}`,
      severity: "error"
    });
  }
  return diagnostics;
}
