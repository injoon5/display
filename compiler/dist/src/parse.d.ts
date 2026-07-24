import type { CardNode } from "./ast.js";
import type { Span } from "./types.js";
export declare class MarkupParseError extends Error {
    readonly span: Span;
    constructor(message: string, span: Span);
}
export declare function parseMxml(source: string): CardNode;
