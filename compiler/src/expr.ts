import { applyFilter } from "./filters.js";
import type { Position, Span } from "./types.js";

type ExprTokenKind =
  | "colon"
  | "comma"
  | "dot"
  | "eof"
  | "identifier"
  | "lparen"
  | "number"
  | "operator"
  | "pipe"
  | "question"
  | "rparen"
  | "string";

interface ExprToken {
  kind: ExprTokenKind;
  value: string;
  span: Span;
}

export type LiteralValue = boolean | null | number | string;

interface ExprBase {
  span: Span;
}

export interface LiteralExpr extends ExprBase {
  kind: "literal";
  value: LiteralValue;
}

export interface PathExpr extends ExprBase {
  kind: "path";
  segments: string[];
}

export interface UnaryExpr extends ExprBase {
  kind: "unary";
  op: "-" | "not";
  argument: Expr;
}

export interface BinaryExpr extends ExprBase {
  kind: "binary";
  op: "%" | "*" | "+" | "-" | "/" | "<" | "<=" | "==" | "!=" | ">" | ">=" | "and" | "or";
  left: Expr;
  right: Expr;
}

export interface TernaryExpr extends ExprBase {
  kind: "ternary";
  test: Expr;
  consequent: Expr;
  alternate: Expr;
}

export interface FilterExpr extends ExprBase {
  kind: "filter";
  input: Expr;
  name: string;
  args: Expr[];
}

export type Expr = BinaryExpr | FilterExpr | LiteralExpr | PathExpr | TernaryExpr | UnaryExpr;

export class ExprParseError extends Error {
  public readonly span: Span;

  public constructor(message: string, span: Span) {
    super(message);
    this.name = "ExprParseError";
    this.span = span;
  }
}

function clonePosition(position: Position): Position {
  return { column: position.column, line: position.line, offset: position.offset };
}

function makeSpan(start: Position, end: Position): Span {
  return { end: clonePosition(end), start: clonePosition(start) };
}

function advancePosition(position: Position, value: string): Position {
  const next = clonePosition(position);
  for (const char of value) {
    next.offset += 1;
    if (char === "\n") {
      next.line += 1;
      next.column = 1;
    } else {
      next.column += 1;
    }
  }
  return next;
}

function tokenizeExpression(source: string, base?: Position): ExprToken[] {
  const tokens: ExprToken[] = [];
  let position: Position = base ? clonePosition(base) : { column: 1, line: 1, offset: 0 };
  let index = 0;

  const push = (kind: ExprTokenKind, value: string): void => {
    const start = clonePosition(position);
    position = advancePosition(position, value);
    tokens.push({ kind, span: makeSpan(start, position), value });
  };

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      push("operator", char);
      tokens.pop();
      index += 1;
      continue;
    }

    const two = source.slice(index, index + 2);
    if (["==", "!=", "<=", ">="].includes(two)) {
      push("operator", two);
      index += 2;
      continue;
    }

    if (["<", ">", "+", "-", "*", "/", "%"].includes(char)) {
      push("operator", char);
      index += 1;
      continue;
    }

    if (char === "(") {
      push("lparen", char);
      index += 1;
      continue;
    }
    if (char === ")") {
      push("rparen", char);
      index += 1;
      continue;
    }
    if (char === "?") {
      push("question", char);
      index += 1;
      continue;
    }
    if (char === ":") {
      push("colon", char);
      index += 1;
      continue;
    }
    if (char === ",") {
      push("comma", char);
      index += 1;
      continue;
    }
    if (char === "|") {
      push("pipe", char);
      index += 1;
      continue;
    }
    if (char === ".") {
      push("dot", char);
      index += 1;
      continue;
    }

    if (char === "'" || char === "\"") {
      const quote = char;
      const start = clonePosition(position);
      let raw = quote;
      index += 1;
      position = advancePosition(position, quote);
      let closed = false;
      while (index < source.length) {
        const next = source[index];
        raw += next;
        index += 1;
        position = advancePosition(position, next);
        if (next === quote) {
          closed = true;
          break;
        }
      }
      if (!closed) {
        throw new ExprParseError("Unterminated string literal", makeSpan(start, position));
      }
      tokens.push({
        kind: "string",
        span: makeSpan(start, position),
        value: raw.slice(1, -1)
      });
      continue;
    }

    if (/\d/.test(char)) {
      const start = clonePosition(position);
      let value = char;
      index += 1;
      position = advancePosition(position, char);
      while (index < source.length && /[\d.]/.test(source[index])) {
        value += source[index];
        position = advancePosition(position, source[index]);
        index += 1;
      }
      tokens.push({
        kind: "number",
        span: makeSpan(start, position),
        value
      });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = clonePosition(position);
      let value = char;
      index += 1;
      position = advancePosition(position, char);
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {
        value += source[index];
        position = advancePosition(position, source[index]);
        index += 1;
      }
      tokens.push({
        kind: "identifier",
        span: makeSpan(start, position),
        value
      });
      continue;
    }

    throw new ExprParseError(`Unexpected token '${char}'`, makeSpan(position, advancePosition(position, char)));
  }

  tokens.push({
    kind: "eof",
    span: makeSpan(position, position),
    value: ""
  });
  return tokens;
}

class Parser {
  private readonly tokens: ExprToken[];
  private index = 0;

  public constructor(tokens: ExprToken[]) {
    this.tokens = tokens;
  }

  public parse(): Expr {
    const expr = this.parseTernary();
    this.expect("eof");
    return expr;
  }

  private current(): ExprToken {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
  }

  private advance(): ExprToken {
    const token = this.current();
    this.index += 1;
    return token;
  }

  private expect(kind: ExprTokenKind, value?: string): ExprToken {
    const token = this.current();
    if (token.kind !== kind || (value !== undefined && token.value !== value)) {
      throw new ExprParseError(`Expected ${value ?? kind}`, token.span);
    }
    return this.advance();
  }

  private match(kind: ExprTokenKind, value?: string): ExprToken | null {
    const token = this.current();
    if (token.kind === kind && (value === undefined || token.value === value)) {
      return this.advance();
    }
    return null;
  }

  private parseTernary(): Expr {
    const test = this.parseOr();
    if (!this.match("question")) {
      return test;
    }
    const consequent = this.parseTernary();
    this.expect("colon");
    const alternate = this.parseTernary();
    return {
      alternate,
      consequent,
      kind: "ternary",
      span: makeSpan(test.span.start, alternate.span.end),
      test
    };
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.current().kind === "identifier" && this.current().value === "or") {
      this.advance();
      const right = this.parseAnd();
      left = {
        kind: "binary",
        left,
        op: "or",
        right,
        span: makeSpan(left.span.start, right.span.end)
      };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.current().kind === "identifier" && this.current().value === "and") {
      this.advance();
      const right = this.parseNot();
      left = {
        kind: "binary",
        left,
        op: "and",
        right,
        span: makeSpan(left.span.start, right.span.end)
      };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.current().kind === "identifier" && this.current().value === "not") {
      const start = this.advance();
      const argument = this.parseNot();
      return {
        argument,
        kind: "unary",
        op: "not",
        span: makeSpan(start.span.start, argument.span.end)
      };
    }
    return this.parseCompare();
  }

  private parseCompare(): Expr {
    let left = this.parseAdd();
    const token = this.current();
    if (token.kind === "operator" && ["==", "!=", "<", "<=", ">", ">="].includes(token.value)) {
      this.advance();
      const right = this.parseAdd();
      left = {
        kind: "binary",
        left,
        op: token.value as BinaryExpr["op"],
        right,
        span: makeSpan(left.span.start, right.span.end)
      };
    }
    return left;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (this.current().kind === "operator" && ["+", "-"].includes(this.current().value)) {
      const token = this.advance();
      const right = this.parseMul();
      left = {
        kind: "binary",
        left,
        op: token.value as BinaryExpr["op"],
        right,
        span: makeSpan(left.span.start, right.span.end)
      };
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parseUnary();
    while (this.current().kind === "operator" && ["*", "/", "%"].includes(this.current().value)) {
      const token = this.advance();
      const right = this.parseUnary();
      left = {
        kind: "binary",
        left,
        op: token.value as BinaryExpr["op"],
        right,
        span: makeSpan(left.span.start, right.span.end)
      };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.current().kind === "operator" && this.current().value === "-") {
      const start = this.advance();
      const argument = this.parseUnary();
      return {
        argument,
        kind: "unary",
        op: "-",
        span: makeSpan(start.span.start, argument.span.end)
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let input = this.parsePrimary();
    while (this.match("pipe")) {
      const name = this.expect("identifier");
      const args: Expr[] = [];
      if (this.match("lparen")) {
        if (!this.match("rparen")) {
          do {
            args.push(this.parseTernary());
          } while (this.match("comma"));
          this.expect("rparen");
        }
      }
      input = {
        args,
        input,
        kind: "filter",
        name: name.value,
        span: makeSpan(input.span.start, (args.at(-1) ?? name).span.end)
      };
    }
    return input;
  }

  private parsePrimary(): Expr {
    const token = this.current();
    if (token.kind === "number") {
      this.advance();
      return {
        kind: "literal",
        span: token.span,
        value: token.value.includes(".") ? Number.parseFloat(token.value) : Number.parseInt(token.value, 10)
      };
    }
    if (token.kind === "string") {
      this.advance();
      return { kind: "literal", span: token.span, value: token.value };
    }
    if (token.kind === "identifier") {
      if (token.value === "true" || token.value === "false") {
        this.advance();
        return { kind: "literal", span: token.span, value: token.value === "true" };
      }
      if (token.value === "null") {
        this.advance();
        return { kind: "literal", span: token.span, value: null };
      }

      this.advance();
      const segments = [token.value];
      let end = token.span.end;
      while (this.match("dot")) {
        const next = this.expect("identifier");
        segments.push(next.value);
        end = next.span.end;
      }
      return {
        kind: "path",
        segments,
        span: makeSpan(token.span.start, end)
      };
    }
    if (this.match("lparen")) {
      const expr = this.parseTernary();
      this.expect("rparen");
      return expr;
    }
    throw new ExprParseError(`Unexpected ${token.kind}`, token.span);
  }
}

export function parseExpression(source: string, base?: Position): Expr {
  const tokens = tokenizeExpression(source, base);
  return new Parser(tokens).parse();
}

function resolvePath(scope: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = scope;
  for (const segment of path) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function evaluateExpression(expr: Expr, scope: Record<string, unknown>): unknown {
  switch (expr.kind) {
    case "literal":
      return expr.value;
    case "path":
      return resolvePath(scope, expr.segments);
    case "unary": {
      const value = evaluateExpression(expr.argument, scope);
      return expr.op === "-" ? -Number(value) : !Boolean(value);
    }
    case "binary": {
      const left = evaluateExpression(expr.left, scope);
      const right = evaluateExpression(expr.right, scope);
      switch (expr.op) {
        case "+":
          return Number(left) + Number(right);
        case "-":
          return Number(left) - Number(right);
        case "*":
          return Number(left) * Number(right);
        case "/":
          return Number(left) / Number(right);
        case "%":
          return Number(left) % Number(right);
        case "==":
          return left === right;
        case "!=":
          return left !== right;
        case "<":
          return Number(left) < Number(right);
        case "<=":
          return Number(left) <= Number(right);
        case ">":
          return Number(left) > Number(right);
        case ">=":
          return Number(left) >= Number(right);
        case "and":
          return Boolean(left) && Boolean(right);
        case "or":
          return Boolean(left) || Boolean(right);
      }
    }
    case "filter": {
      const input = evaluateExpression(expr.input, scope);
      const args = expr.args.map((arg) => evaluateExpression(arg, scope));
      return applyFilter(expr.name, input, args);
    }
    case "ternary":
      return Boolean(evaluateExpression(expr.test, scope))
        ? evaluateExpression(expr.consequent, scope)
        : evaluateExpression(expr.alternate, scope);
    default: {
      const exhaustive: never = expr;
      return exhaustive;
    }
  }
}

export function collectPathReferences(expr: Expr): string[] {
  const values = new Set<string>();
  const visit = (node: Expr): void => {
    switch (node.kind) {
      case "literal":
        return;
      case "path":
        values.add(node.segments.join("."));
        return;
      case "unary":
        visit(node.argument);
        return;
      case "binary":
        visit(node.left);
        visit(node.right);
        return;
      case "ternary":
        visit(node.test);
        visit(node.consequent);
        visit(node.alternate);
        return;
      case "filter":
        visit(node.input);
        for (const arg of node.args) {
          visit(arg);
        }
        return;
      default: {
        const exhaustive: never = node;
        return exhaustive;
      }
    }
  };
  visit(expr);
  return [...values];
}

export function isConstantExpression(expr: Expr): boolean {
  switch (expr.kind) {
    case "literal":
      return true;
    case "path":
      return false;
    case "unary":
      return isConstantExpression(expr.argument);
    case "binary":
      return isConstantExpression(expr.left) && isConstantExpression(expr.right);
    case "ternary":
      return isConstantExpression(expr.test) && isConstantExpression(expr.consequent) && isConstantExpression(expr.alternate);
    case "filter":
      return isConstantExpression(expr.input) && expr.args.every(isConstantExpression);
    default: {
      const exhaustive: never = expr;
      return exhaustive;
    }
  }
}

export function exprToString(expr: Expr): string {
  switch (expr.kind) {
    case "literal":
      return expr.value === null ? "null" : JSON.stringify(expr.value);
    case "path":
      return expr.segments.join(".");
    case "unary":
      return `${expr.op} ${exprToString(expr.argument)}`;
    case "binary":
      return `${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)}`;
    case "ternary":
      return `${exprToString(expr.test)} ? ${exprToString(expr.consequent)} : ${exprToString(expr.alternate)}`;
    case "filter":
      return `${exprToString(expr.input)} | ${expr.name}${expr.args.length > 0 ? `(${expr.args.map(exprToString).join(", ")})` : ""}`;
    default: {
      const exhaustive: never = expr;
      return exhaustive;
    }
  }
}
