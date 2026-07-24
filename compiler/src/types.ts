export type DiagnosticSeverity = "error" | "warning";

export interface Position {
  offset: number;
  line: number;
  column: number;
}

export interface Span {
  start: Position;
  end: Position;
}

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  code: string;
  span?: Span;
  hint?: string;
}

export interface CompileOptions {
  filename?: string;
}

export interface SlotMapEntry {
  index: number;
  path: string;
  type: string;
  sourceId: string;
}

export interface CompileResult {
  bytecode: Uint8Array;
  slotMap: SlotMapEntry[];
  diagnostics: Diagnostic[];
  estimatedAmps: number;
  sources: string[];
}

export type ValueKind =
  | "bool"
  | "color"
  | "float"
  | "int"
  | "null"
  | "object"
  | "string"
  | "unknown";

export interface TypeInfo {
  kind: ValueKind;
  nullable: boolean;
  fields?: Record<string, TypeInfo>;
}

export interface InternedString {
  index: number;
  value: string;
}

export interface ResolvedTextSource {
  kind: "literal" | "slot";
  value: string | number;
}

export interface EmittedInstruction {
  op: number;
  bytes: number[];
}

export type JsonOp =
  | "bar"
  | "badge"
  | "frect"
  | "icon"
  | "line"
  | "pixel"
  | "rect"
  | "stroke"
  | "text";

export interface JsonElement {
  op: JsonOp;
  [key: string]: unknown;
}

export interface JsonCard {
  id: string;
  elements: JsonElement[];
}

export interface LayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SourceDefinition {
  id: string;
  kind: string;
  attrs: Record<string, string>;
  span: Span;
}

export interface ValidationContext {
  diagnostics: Diagnostic[];
}

export const CANVAS_WIDTH = 64;
export const CANVAS_HEIGHT = 32;
export const MAX_SLOT_COUNT = 255;
