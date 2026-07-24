import { normaliseColorLiteral, rgb565 } from "./colors.js";
import { evaluateExpression, isConstantExpression } from "./expr.js";
import type { LayoutResult, LiteralOrExpr, RenderNode } from "./layout.js";
import type { Diagnostic } from "./types.js";

function foldValue<T extends number | string>(value: LiteralOrExpr<T>): LiteralOrExpr<T> {
  if (!value.expr || !isConstantExpression(value.expr)) {
    return value;
  }
  const result = evaluateExpression(value.expr, {}) as T;
  return { value: result };
}

function foldNode(node: RenderNode): RenderNode {
  if (node.kind === "group") {
    return {
      ...node,
      children: node.children.map(foldNode)
    };
  }

  switch (node.kind) {
    case "text":
      return {
        ...node,
        color: foldValue(node.color)
      };
    case "icon":
      return {
        ...node,
        color: node.color ? foldValue(node.color) : undefined
      };
    case "bar":
      return {
        ...node,
        bg: foldValue(node.bg),
        color: foldValue(node.color),
        max: foldValue(node.max),
        value: foldValue(node.value)
      };
    default:
      return {
        ...node,
        color: foldValue(node.color)
      };
  }
}

function collectLiteralColors(node: RenderNode, output: Array<{ color: string; kind: string }>): void {
  if (node.kind === "group") {
    for (const child of node.children) {
      collectLiteralColors(child, output);
    }
    return;
  }
  const push = (value?: LiteralOrExpr<string>): void => {
    if (value?.value) {
      output.push({ color: value.value, kind: node.kind });
    }
  };
  switch (node.kind) {
    case "bar":
      push(node.color);
      push(node.bg);
      break;
    case "icon":
      push(node.color);
      break;
    default:
      push(node.color);
      break;
  }
}

export function optimiseLayout(layout: LayoutResult): { diagnostics: Diagnostic[]; layout: LayoutResult } {
  const diagnostics: Diagnostic[] = [];
  const nodes = layout.nodes.map(foldNode);

  const colors: Array<{ color: string; kind: string }> = [];
  for (const node of nodes) {
    collectLiteralColors(node, colors);
  }

  const seen = new Map<number, string>();
  for (const entry of colors) {
    try {
      const normalized = normaliseColorLiteral(entry.color);
      const reduced = rgb565(normalized);
      const previous = seen.get(reduced);
      if (previous && previous !== normalized) {
        diagnostics.push({
          code: "color.rgb565-collapse",
          message: `Colours ${previous} and ${normalized} collapse to the same RGB565 value`,
          severity: "warning"
        });
      } else {
        seen.set(reduced, normalized);
      }
    } catch {
      diagnostics.push({
        code: "color.invalid",
        message: `Invalid colour literal '${entry.color}'`,
        severity: "error"
      });
    }
  }

  return {
    diagnostics,
    layout: {
      ...layout,
      nodes
    }
  };
}
