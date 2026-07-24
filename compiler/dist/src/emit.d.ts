import type { LayoutResult } from "./layout.js";
import { type TypecheckContext } from "./typecheck.js";
import type { CompileResult, Diagnostic } from "./types.js";
export declare function emitProgram(layout: LayoutResult, context: TypecheckContext, estimatedAmps: number, diagnostics: Diagnostic[]): CompileResult;
