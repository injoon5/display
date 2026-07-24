import type { CardNode } from "./ast.js";
import { type Expr } from "./expr.js";
import { type ResolveContext } from "./resolve.js";
import type { Diagnostic, TypeInfo } from "./types.js";
export interface TypecheckContext {
    diagnostics: Diagnostic[];
    resolve: ResolveContext;
}
export declare function typeName(type: TypeInfo): string;
export declare function exprPathKey(expr: Expr): string | null;
export declare function extractTruthyGuards(expr: Expr): Set<string>;
export declare function inferExpressionType(expr: Expr, context: TypecheckContext, guards?: Set<string>): TypeInfo;
export declare function typecheckCard(card: CardNode, resolve: ResolveContext): Diagnostic[];
