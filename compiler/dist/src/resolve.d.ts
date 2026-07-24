import type { CardNode } from "./ast.js";
import type { Diagnostic, SourceDefinition, Span, TypeInfo } from "./types.js";
export interface ResolveContext {
    diagnostics: Diagnostic[];
    sources: SourceDefinition[];
    sourceKinds: Map<string, string>;
}
export declare function resolveCard(card: CardNode): ResolveContext;
export declare function resolvePathType(path: string[], context: ResolveContext, span?: Span): TypeInfo | null;
