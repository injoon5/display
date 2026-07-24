import type { Position, Span } from "./types.js";
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
export declare class ExprParseError extends Error {
    readonly span: Span;
    constructor(message: string, span: Span);
}
export declare function parseExpression(source: string, base?: Position): Expr;
export declare function evaluateExpression(expr: Expr, scope: Record<string, unknown>): unknown;
export declare function collectPathReferences(expr: Expr): string[];
export declare function isConstantExpression(expr: Expr): boolean;
export declare function exprToString(expr: Expr): string;
export {};
