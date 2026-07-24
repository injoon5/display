import type { CardNode, TemplatePart } from "./ast.js";
import type { Expr } from "./expr.js";
import { type TypecheckContext } from "./typecheck.js";
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
export interface GroupNode {
    blinkRateMs?: number;
    children: RenderNode[];
    kind: "group";
    span: Span;
    test?: Expr;
}
export type DrawNode = BarDrawable | IconDrawable | RectDrawable | TextDrawable;
export type RenderNode = DrawNode | GroupNode;
export interface LayoutResult {
    diagnostics: Diagnostic[];
    nodes: RenderNode[];
    show?: Expr;
    stale?: {
        afterMs: number;
        style: string;
    };
}
export declare function parseDuration(value: string): number | null;
export declare function layoutCard(card: CardNode, typeContext: TypecheckContext): LayoutResult;
