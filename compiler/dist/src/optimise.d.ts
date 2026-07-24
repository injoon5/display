import type { LayoutResult } from "./layout.js";
import type { Diagnostic } from "./types.js";
export declare function optimiseLayout(layout: LayoutResult): {
    diagnostics: Diagnostic[];
    layout: LayoutResult;
};
