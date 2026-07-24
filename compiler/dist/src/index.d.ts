import type { CompileOptions, CompileResult } from "./types.js";
export { rgb565 } from "./colors.js";
export { collectPathReferences, evaluateExpression, exprToString, isConstantExpression, parseExpression } from "./expr.js";
export type { CompileOptions, CompileResult, Diagnostic, SlotMapEntry } from "./types.js";
export declare function compileJson(source: string | object, _options?: CompileOptions): CompileResult;
export declare function compileMxml(source: string, _options?: CompileOptions): CompileResult;
export declare function compile(source: string | object, options?: CompileOptions): CompileResult;
