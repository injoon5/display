import type { Span } from "./types.js";
export type MarkupTokenKind = "eof" | "equals" | "identifier" | "lt" | "ltSlash" | "slashGt" | "gt" | "string" | "text";
export interface MarkupToken {
    kind: MarkupTokenKind;
    span: Span;
    value: string;
}
export declare function lexMarkup(source: string): MarkupToken[];
