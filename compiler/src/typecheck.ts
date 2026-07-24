import type { AttributeValue, CardNode, ElementNode, MxmlNode, TemplatePart, TextNode } from "./ast.js";
import { type Expr } from "./expr.js";
import { resolvePathType, type ResolveContext } from "./resolve.js";
import type { Diagnostic, TypeInfo } from "./types.js";

export interface TypecheckContext {
  diagnostics: Diagnostic[];
  resolve: ResolveContext;
}

export function typeName(type: TypeInfo): string {
  const base = type.kind;
  return type.nullable ? `${base}|null` : base;
}

function scalar(type: TypeInfo): boolean {
  return type.kind !== "object";
}

function literalType(value: boolean | null | number | string): TypeInfo {
  if (value === null) {
    return { kind: "null", nullable: true };
  }
  switch (typeof value) {
    case "boolean":
      return { kind: "bool", nullable: false };
    case "number":
      return { kind: Number.isInteger(value) ? "int" : "float", nullable: false };
    case "string":
      return { kind: value.startsWith("#") ? "color" : "string", nullable: false };
  }
}

export function exprPathKey(expr: Expr): string | null {
  return expr.kind === "path" ? expr.segments.join(".") : null;
}

export function extractTruthyGuards(expr: Expr): Set<string> {
  const guards = new Set<string>();
  if (
    expr.kind === "binary" &&
    expr.op === "!=" &&
    ((expr.left.kind === "path" && expr.right.kind === "literal" && expr.right.value === null) ||
      (expr.right.kind === "path" && expr.left.kind === "literal" && expr.left.value === null))
  ) {
    const path = expr.left.kind === "path" ? expr.left : expr.right.kind === "path" ? expr.right : null;
    if (path) {
      guards.add(path.segments.join("."));
    }
  }
  return guards;
}

function isNumeric(type: TypeInfo): boolean {
  return type.kind === "float" || type.kind === "int";
}

function requireNonNull(type: TypeInfo, diagnostics: Diagnostic[], message: string, code: string, span: Expr["span"]): void {
  if (type.nullable) {
    diagnostics.push({
      code,
      message,
      severity: "error",
      span
    });
  }
}

function inferFilterType(name: string, input: TypeInfo, argTypes: TypeInfo[]): TypeInfo {
  switch (name) {
    case "round":
    case "floor":
    case "ceil":
    case "abs":
    case "map":
    case "clamp":
      return { kind: "float", nullable: false };
    case "pad":
    case "comma":
    case "fixed":
    case "upper":
    case "lower":
    case "trunc":
    case "relative":
    case "duration":
    case "hhmm":
    case "hhmmss":
    case "date":
    case "icon_for":
      return { kind: "string", nullable: false };
    case "color_scale":
      return { kind: "color", nullable: false };
    case "default": {
      const fallback = argTypes[0] ?? { kind: "unknown", nullable: false };
      if (input.kind === "null") {
        return { ...fallback, nullable: false };
      }
      if (fallback.kind === input.kind || fallback.kind === "unknown") {
        return { ...input, nullable: false };
      }
      return { kind: "unknown", nullable: false };
    }
    default:
      return { kind: "unknown", nullable: false };
  }
}

export function inferExpressionType(expr: Expr, context: TypecheckContext, guards: Set<string> = new Set()): TypeInfo {
  switch (expr.kind) {
    case "literal":
      return literalType(expr.value);
    case "path": {
      const resolved = resolvePathType(expr.segments, context.resolve, expr.span);
      if (!resolved) {
        return { kind: "unknown", nullable: true };
      }
      if (guards.has(expr.segments.join("."))) {
        return { ...resolved, nullable: false };
      }
      return resolved;
    }
    case "unary": {
      const argument = inferExpressionType(expr.argument, context, guards);
      requireNonNull(argument, context.diagnostics, "unguarded nullable", "type.nullable", expr.argument.span);
      if (expr.op === "not") {
        return { kind: "bool", nullable: false };
      }
      return { kind: argument.kind === "int" ? "int" : "float", nullable: false };
    }
    case "binary": {
      const left = inferExpressionType(expr.left, context, guards);
      const right = inferExpressionType(expr.right, context, guards);

      if (["and", "or"].includes(expr.op)) {
        requireNonNull(left, context.diagnostics, "unguarded nullable", "type.nullable", expr.left.span);
        requireNonNull(right, context.diagnostics, "unguarded nullable", "type.nullable", expr.right.span);
        return { kind: "bool", nullable: false };
      }

      if (["+", "-", "*", "/", "%"].includes(expr.op)) {
        requireNonNull(left, context.diagnostics, "unguarded nullable", "type.nullable", expr.left.span);
        requireNonNull(right, context.diagnostics, "unguarded nullable", "type.nullable", expr.right.span);
        if (!isNumeric(left) || !isNumeric(right)) {
          context.diagnostics.push({
            code: "type.numeric",
            message: `Operator '${expr.op}' expects numeric operands`,
            severity: "error",
            span: expr.span
          });
        }
        return { kind: left.kind === "int" && right.kind === "int" && expr.op !== "/" ? "int" : "float", nullable: false };
      }

      const isNullCompare = (expr.left.kind === "literal" && expr.left.value === null) || (expr.right.kind === "literal" && expr.right.value === null);
      if (!isNullCompare) {
        requireNonNull(left, context.diagnostics, "unguarded nullable", "type.nullable", expr.left.span);
        requireNonNull(right, context.diagnostics, "unguarded nullable", "type.nullable", expr.right.span);
      }
      return { kind: "bool", nullable: false };
    }
    case "ternary": {
      const testType = inferExpressionType(expr.test, context, guards);
      requireNonNull(testType, context.diagnostics, "unguarded nullable", "type.nullable", expr.test.span);
      const guarded = new Set<string>(guards);
      for (const guard of extractTruthyGuards(expr.test)) {
        guarded.add(guard);
      }
      const consequent = inferExpressionType(expr.consequent, context, guarded);
      const alternate = inferExpressionType(expr.alternate, context, guards);
      if (consequent.kind === alternate.kind) {
        return { kind: consequent.kind, nullable: consequent.nullable || alternate.nullable };
      }
      if (consequent.kind === "null") {
        return { ...alternate, nullable: true };
      }
      if (alternate.kind === "null") {
        return { ...consequent, nullable: true };
      }
      return { kind: "unknown", nullable: consequent.nullable || alternate.nullable };
    }
    case "filter": {
      const input = inferExpressionType(expr.input, context, guards);
      const args = expr.args.map((arg) => inferExpressionType(arg, context, guards));
      if (expr.name !== "default") {
        requireNonNull(input, context.diagnostics, "unguarded nullable", "type.nullable", expr.input.span);
      }
      return inferFilterType(expr.name, input, args);
    }
    default: {
      const exhaustive: never = expr;
      return exhaustive;
    }
  }
}

function attributeExpr(attrs: Record<string, AttributeValue>, name: string): Expr | null {
  const value = attrs[name];
  return value?.kind === "expression" ? value.expr : null;
}

function checkScalarTemplate(parts: TemplatePart[], context: TypecheckContext, guards: Set<string>): void {
  for (const part of parts) {
    if (part.kind !== "expression") {
      continue;
    }
    const type = inferExpressionType(part.expr, context, guards);
    if (!scalar(type)) {
      context.diagnostics.push({
        code: "type.template-object",
        message: "Template expressions must resolve to a scalar value",
        severity: "error",
        span: part.span
      });
    }
    if (type.nullable) {
      context.diagnostics.push({
        code: "type.nullable-template",
        hint: "Add | default(...) or guard with <when test=\"{{ path != null }}\">.",
        message: "unguarded nullable",
        severity: "error",
        span: part.span
      });
    }
  }
}

function checkNode(node: MxmlNode, context: TypecheckContext, guards: Set<string>): void {
  switch (node.tagName) {
    case "source":
      return;
    case "text":
      checkScalarTemplate(node.template, context, guards);
      break;
    case "badge":
      checkScalarTemplate(node.template ?? [], context, guards);
      break;
    case "show": {
      const expr = attributeExpr(node.attrs, "when");
      if (expr) {
        inferExpressionType(expr, context, guards);
      }
      break;
    }
    case "when": {
      const expr = attributeExpr(node.attrs, "test");
      if (expr) {
        inferExpressionType(expr, context, guards);
        const nextGuards = new Set<string>(guards);
        for (const guard of extractTruthyGuards(expr)) {
          nextGuards.add(guard);
        }
        for (const child of node.children) {
          checkNode(child, context, nextGuards);
        }
        return;
      }
      break;
    }
    case "bar": {
      for (const key of ["value", "max"] as const) {
        const expr = attributeExpr(node.attrs, key);
        if (expr) {
          const type = inferExpressionType(expr, context, guards);
          if (!isNumeric(type)) {
            context.diagnostics.push({
              code: "type.bar",
              message: `<bar ${key}> expects a numeric expression`,
              severity: "error",
              span: expr.span
            });
          }
        }
      }
      break;
    }
    default: {
      for (const key of ["color", "bg"] as const) {
        const expr = attributeExpr(node.attrs, key);
        if (expr) {
          inferExpressionType(expr, context, guards);
        }
      }
      break;
    }
  }

  if ("children" in node) {
    for (const child of node.children) {
      checkNode(child, context, guards);
    }
  }
}

export function typecheckCard(card: CardNode, resolve: ResolveContext): Diagnostic[] {
  const context: TypecheckContext = {
    diagnostics: [...resolve.diagnostics],
    resolve
  };
  for (const child of card.children) {
    checkNode(child, context, new Set());
  }
  return context.diagnostics;
}
