import { rgb565 } from "./colors.js";
import { collectPathReferences, exprToString, type Expr } from "./expr.js";
import { fontId } from "./fonts.js";
import type { BarDrawable, DrawNode, LayoutResult, RenderNode, TextDrawable } from "./layout.js";
import { inferExpressionType, type TypecheckContext, typeName } from "./typecheck.js";
import type { CompileResult, Diagnostic, SlotMapEntry } from "./types.js";

const HEADER_SIZE = 84;
const VERSION = 1;

const OPCODES = {
  BLINK: 0x60,
  BLIT: 0x30,
  BLITC: 0x31,
  FRECT: 0x10,
  HALT: 0xff,
  JMP: 0x40,
  JMPCMP: 0x42,
  JMPSTALE: 0x43,
  JMPZ: 0x41,
  LINE: 0x12,
  PIXEL: 0x13,
  POPDIM: 0x53,
  PUSHDIM: 0x52,
  RECT: 0x11,
  TEXT: 0x20
} as const;

type CmpOp = "!=" | "<" | "<=" | "==" | ">" | ">=";

interface SimpleCondition {
  expr?: Expr;
  kind: "cmp" | "slot";
  op?: CmpOp;
  path: string;
  value?: boolean | number | string;
}

class ByteWriter {
  public readonly bytes: number[] = [];

  public get length(): number {
    return this.bytes.length;
  }

  public patchU16(offset: number, value: number): void {
    this.bytes[offset] = value & 0xff;
    this.bytes[offset + 1] = (value >> 8) & 0xff;
  }

  public writeI32(value: number): void {
    const view = new DataView(new ArrayBuffer(4));
    view.setInt32(0, value, true);
    this.writeBytes(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  }

  public writeBytes(...values: number[]): void {
    this.bytes.push(...values.map((value) => value & 0xff));
  }

  public writeU16(value: number): void {
    this.writeBytes(value & 0xff, (value >> 8) & 0xff);
  }

  public writeU32(value: number): void {
    this.writeBytes(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
  }

  public writeU8(value: number): void {
    this.writeBytes(value);
  }
}

class SlotRegistry {
  private readonly byKey = new Map<string, number>();
  private readonly entries: SlotMapEntry[] = [];

  public get slotMap(): SlotMapEntry[] {
    return this.entries;
  }

  public firstSourceSlot(sourceId: string): number | null {
    const entry = this.entries.find((candidate) => candidate.sourceId === sourceId);
    return entry ? entry.index : null;
  }

  public reserveComputed(key: string, type: string, sourceId: string): number {
    return this.reserve(`computed:${key}`, key, type, sourceId);
  }

  public reservePath(path: string, type: string, sourceId: string): number {
    return this.reserve(`path:${sourceId}:${path}`, path, type, sourceId);
  }

  private reserve(key: string, path: string, type: string, sourceId: string): number {
    const existing = this.byKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const index = this.entries.length;
    this.byKey.set(key, index);
    this.entries.push({ index, path, sourceId, type });
    return index;
  }
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function cmpCode(op: CmpOp): number {
  switch (op) {
    case "==":
      return 0;
    case "!=":
      return 1;
    case "<":
      return 2;
    case "<=":
      return 3;
    case ">":
      return 4;
    case ">=":
      return 5;
    default: {
      const exhaustive: never = op;
      return exhaustive;
    }
  }
}

function invertCmp(op: CmpOp): CmpOp {
  switch (op) {
    case "==":
      return "!=";
    case "!=":
      return "==";
    case "<":
      return ">=";
    case "<=":
      return ">";
    case ">":
      return "<=";
    case ">=":
      return "<";
    default: {
      const exhaustive: never = op;
      return exhaustive;
    }
  }
}

function simpleCondition(expr: Expr): SimpleCondition | null {
  if (expr.kind === "path") {
    return { kind: "slot", path: expr.segments.join(".") };
  }
  if (
    expr.kind === "binary" &&
    ["==", "!=", "<", "<=", ">", ">="].includes(expr.op) &&
    expr.left.kind === "path" &&
    expr.right.kind === "literal" &&
    typeof expr.right.value !== "object"
  ) {
    return {
      expr,
      kind: "cmp",
      op: expr.op as CmpOp,
      path: expr.left.segments.join("."),
      value: expr.right.value
    };
  }
  return null;
}

function sourceIdForDeps(paths: string[], context: TypecheckContext): string {
  const roots = new Set<string>();
  for (const path of paths) {
    const root = path.split(".")[0];
    if (context.resolve.sourceKinds.has(root)) {
      roots.add(root);
    }
  }
  if (roots.size === 1) {
    return [...roots][0] ?? "computed";
  }
  return roots.size === 0 ? "ambient" : "computed";
}

function slotForExpr(expr: Expr, context: TypecheckContext, slots: SlotRegistry): number {
  if (expr.kind === "path") {
    const root = expr.segments[0];
    const sourceId = context.resolve.sourceKinds.has(root) ? root : root;
    const type = context.resolve.sourceKinds.has(root) ? typeName(inferExpressionType(expr, context)) : "unknown";
    return slots.reservePath(expr.segments.join("."), type, sourceId);
  }
  const key = exprToString(expr);
  const type = inferExpressionType(expr, context);
  const deps = collectPathReferences(expr);
  return slots.reserveComputed(key, typeName(type), sourceIdForDeps(deps, context));
}

function templateKey(node: TextDrawable): string {
  return node.template
    .map((part) => (part.kind === "literal" ? part.value : `{{${exprToString(part.expr)}}}`))
    .join("");
}

function emitStringTable(strings: string[]): Uint8Array {
  const writer = new ByteWriter();
  writer.writeU16(strings.length);
  for (const value of strings) {
    const bytes = utf8Bytes(value);
    writer.writeU16(bytes.length);
    writer.writeBytes(...bytes);
  }
  return new Uint8Array(writer.bytes);
}

function ensureLiteralColor(value: string, diagnostics: Diagnostic[], span: DrawNode["span"]): number {
  try {
    return rgb565(value);
  } catch {
    diagnostics.push({
      code: "emit.color",
      message: `Invalid colour '${value}'`,
      severity: "error",
      span
    });
    return rgb565("#ffffff");
  }
}

function simpleTemplateSlot(node: TextDrawable, context: TypecheckContext, slots: SlotRegistry, intern: Map<string, number>): number {
  const dynamicParts = node.template.filter((part) => part.kind === "expression");
  if (dynamicParts.length === 0) {
    const text = node.template.map((part) => (part.kind === "literal" ? part.value : "")).join("");
    return intern.get(text) ?? 0;
  }
  if (dynamicParts.length === 1 && node.template.length === 1 && dynamicParts[0]?.kind === "expression") {
    return 0x80 | slotForExpr(dynamicParts[0].expr, context, slots);
  }
  const key = `template:${templateKey(node)}`;
  const slot = slots.reserveComputed(key, "string", sourceIdForDeps(dynamicParts.flatMap((part) => collectPathReferences(part.expr)), context));
  return 0x80 | slot;
}

function emitText(writer: ByteWriter, node: TextDrawable, context: TypecheckContext, slots: SlotRegistry, intern: Map<string, number>, diagnostics: Diagnostic[]): void {
  if (node.color.expr) {
    const expr = node.color.expr;
    if (
      expr.kind === "ternary" &&
      expr.consequent.kind === "literal" &&
      expr.alternate.kind === "literal" &&
      typeof expr.consequent.value === "string" &&
      typeof expr.alternate.value === "string"
    ) {
      const consequentColor = expr.consequent.value;
      const alternateColor = expr.alternate.value;
      emitConditional(writer, expr.test, context, slots, diagnostics, () => {
        emitText(writer, { ...node, color: { value: consequentColor } }, context, slots, intern, diagnostics);
      }, () => {
        emitText(writer, { ...node, color: { value: alternateColor } }, context, slots, intern, diagnostics);
      });
      return;
    }
    diagnostics.push({
      code: "emit.dynamic-color",
      message: "Only ternary literal colour expressions are supported in Stage 1",
      severity: "error",
      span: node.span
    });
  }
  const color = ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span);
  const source = simpleTemplateSlot(node, context, slots, intern);
  writer.writeU8(OPCODES.TEXT);
  writer.writeU8(node.x);
  writer.writeU8(node.y);
  writer.writeU8(fontId(node.font));
  writer.writeU16(color);
  writer.writeU8(source);
}

function emitConditional(
  writer: ByteWriter,
  expr: Expr,
  context: TypecheckContext,
  slots: SlotRegistry,
  diagnostics: Diagnostic[],
  consequent: () => void,
  alternate?: () => void
): void {
  const condition = simpleCondition(expr);
  if (condition?.kind === "slot") {
    const slot = slots.reservePath(condition.path, "bool", context.resolve.sourceKinds.has(condition.path.split(".")[0]) ? condition.path.split(".")[0] : "ambient");
    writer.writeU8(OPCODES.JMPZ);
    writer.writeU8(slot);
    const jumpOffset = writer.length;
    writer.writeU16(0);
    consequent();
    if (alternate) {
      writer.writeU8(OPCODES.JMP);
      const endJump = writer.length;
      writer.writeU16(0);
      writer.patchU16(jumpOffset, writer.length);
      alternate();
      writer.patchU16(endJump, writer.length);
    } else {
      writer.patchU16(jumpOffset, writer.length);
    }
    return;
  }

  if (condition?.kind === "cmp" && typeof condition.value === "number") {
    const sourceId = context.resolve.sourceKinds.has(condition.path.split(".")[0]) ? condition.path.split(".")[0] : "ambient";
    const slot = slots.reservePath(condition.path, "int", sourceId);
    writer.writeU8(OPCODES.JMPCMP);
    writer.writeU8(slot);
    writer.writeU8(cmpCode(invertCmp(condition.op ?? "==")));
    writer.writeI32(Math.trunc(condition.value));
    const jumpOffset = writer.length;
    writer.writeU16(0);
    consequent();
    if (alternate) {
      writer.writeU8(OPCODES.JMP);
      const endJump = writer.length;
      writer.writeU16(0);
      writer.patchU16(jumpOffset, writer.length);
      alternate();
      writer.patchU16(endJump, writer.length);
    } else {
      writer.patchU16(jumpOffset, writer.length);
    }
    return;
  }

  const slot = slotForExpr(expr, context, slots);
  writer.writeU8(OPCODES.JMPZ);
  writer.writeU8(slot);
  const jumpOffset = writer.length;
  writer.writeU16(0);
  consequent();
  if (alternate) {
    writer.writeU8(OPCODES.JMP);
    const endJump = writer.length;
    writer.writeU16(0);
    writer.patchU16(jumpOffset, writer.length);
    alternate();
    writer.patchU16(endJump, writer.length);
  } else {
    writer.patchU16(jumpOffset, writer.length);
  }
}

function emitBar(writer: ByteWriter, node: BarDrawable, context: TypecheckContext, slots: SlotRegistry, diagnostics: Diagnostic[]): void {
  const bgColor = ensureLiteralColor(node.bg.value ?? "#202020", diagnostics, node.span);
  const fillColor = ensureLiteralColor(node.color.value ?? "#33cc66", diagnostics, node.span);
  writer.writeU8(OPCODES.FRECT);
  writer.writeU8(node.x);
  writer.writeU8(node.y);
  writer.writeU8(node.w);
  writer.writeU8(node.h);
  writer.writeU16(bgColor);

  if (node.value.value !== undefined && node.max.value !== undefined) {
    const ratio = node.max.value === 0 ? 0 : Math.max(0, Math.min(1, node.value.value / node.max.value));
    const fillWidth = Math.round(node.w * ratio);
    writer.writeU8(OPCODES.FRECT);
    writer.writeU8(node.x);
    writer.writeU8(node.y);
    writer.writeU8(fillWidth);
    writer.writeU8(node.h);
    writer.writeU16(fillColor);
    return;
  }

  if (node.max.value === undefined || !Number.isInteger(node.max.value) || node.max.value <= 0) {
    diagnostics.push({
      code: "emit.bar-max",
      message: "Dynamic <bar max> is not supported in Stage 1",
      severity: "error",
      span: node.span
    });
    return;
  }

  const valueExpr = node.value.expr;
  const slot = valueExpr ? slotForExpr(valueExpr, context, slots) : slots.reserveComputed(`bar:${node.x}:${node.y}`, "int", "computed");
  const checkJumps: Array<{ offset: number; step: number }> = [];
  const endJumps: number[] = [];
  for (let step = node.max.value; step >= 1; step -= 1) {
    writer.writeU8(OPCODES.JMPCMP);
    writer.writeU8(slot);
    writer.writeU8(cmpCode(">="));
    writer.writeI32(step);
    const jumpToFill = writer.length;
    writer.writeU16(0);
    checkJumps.push({ offset: jumpToFill, step });
  }
  writer.writeU8(OPCODES.JMP);
  const emptyJump = writer.length;
  writer.writeU16(0);
  for (const check of checkJumps) {
    writer.patchU16(check.offset, writer.length);
    writer.writeU8(OPCODES.FRECT);
    writer.writeU8(node.x);
    writer.writeU8(node.y);
    writer.writeU8(Math.round((node.w * check.step) / node.max.value));
    writer.writeU8(node.h);
    writer.writeU16(fillColor);
    writer.writeU8(OPCODES.JMP);
    endJumps.push(writer.length);
    writer.writeU16(0);
  }
  writer.patchU16(emptyJump, writer.length);
  for (const offset of endJumps) {
    writer.patchU16(offset, writer.length);
  }
}

function emitDrawNode(writer: ByteWriter, node: DrawNode, context: TypecheckContext, slots: SlotRegistry, intern: Map<string, number>, diagnostics: Diagnostic[]): void {
  switch (node.kind) {
    case "text":
      emitText(writer, node, context, slots, intern, diagnostics);
      return;
    case "frect":
      writer.writeU8(OPCODES.FRECT);
      writer.writeU8(node.x);
      writer.writeU8(node.y);
      writer.writeU8(node.w);
      writer.writeU8(node.h);
      writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
      return;
    case "rect":
    case "stroke":
      writer.writeU8(OPCODES.RECT);
      writer.writeU8(node.x);
      writer.writeU8(node.y);
      writer.writeU8(node.w);
      writer.writeU8(node.h);
      writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
      return;
    case "pixel":
      writer.writeU8(OPCODES.PIXEL);
      writer.writeU8(node.x);
      writer.writeU8(node.y);
      writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
      return;
    case "line":
      writer.writeU8(OPCODES.LINE);
      writer.writeU8(node.x);
      writer.writeU8(node.y);
      writer.writeU8(node.x2 ?? node.x);
      writer.writeU8(node.y2 ?? node.y);
      writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
      return;
    case "icon": {
      const assetId = 0;
      if (node.color?.value) {
        writer.writeU8(OPCODES.BLITC);
        writer.writeU8(node.x);
        writer.writeU8(node.y);
        writer.writeU16(assetId);
        writer.writeU16(ensureLiteralColor(node.color.value, diagnostics, node.span));
      } else {
        writer.writeU8(OPCODES.BLIT);
        writer.writeU8(node.x);
        writer.writeU8(node.y);
        writer.writeU16(assetId);
      }
      return;
    }
    case "bar":
      emitBar(writer, node, context, slots, diagnostics);
      return;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

function emitRenderNode(writer: ByteWriter, node: RenderNode, context: TypecheckContext, slots: SlotRegistry, intern: Map<string, number>, diagnostics: Diagnostic[]): void {
  if (node.kind !== "group") {
    emitDrawNode(writer, node, context, slots, intern, diagnostics);
    return;
  }
  const emitChildren = (): void => {
    if (node.blinkRateMs !== undefined) {
      writer.writeU8(OPCODES.BLINK);
      writer.writeU16(node.blinkRateMs);
      writer.writeU8(128);
      const endOffset = writer.length;
      writer.writeU16(0);
      for (const child of node.children) {
        emitRenderNode(writer, child, context, slots, intern, diagnostics);
      }
      writer.patchU16(endOffset, writer.length);
      return;
    }
    for (const child of node.children) {
      emitRenderNode(writer, child, context, slots, intern, diagnostics);
    }
  };

  if (node.test) {
    emitConditional(writer, node.test, context, slots, diagnostics, emitChildren);
    return;
  }
  emitChildren();
}

function collectStaticStrings(nodes: RenderNode[]): string[] {
  const values = new Set<string>();
  const visit = (node: RenderNode): void => {
    if (node.kind === "group") {
      for (const child of node.children) {
        visit(child);
      }
      return;
    }
    if (node.kind === "text") {
      const isStatic = node.template.every((part) => part.kind === "literal");
      if (isStatic) {
        values.add(node.template.map((part) => (part.kind === "literal" ? part.value : "")).join(""));
      }
    }
  };
  for (const node of nodes) {
    visit(node);
  }
  return [...values];
}

export function emitProgram(layout: LayoutResult, context: TypecheckContext, estimatedAmps: number, diagnostics: Diagnostic[]): CompileResult {
  const slots = new SlotRegistry();
  const strings = collectStaticStrings(layout.nodes);
  const stringIndex = new Map(strings.map((value, index) => [value, index]));

  const code = new ByteWriter();
  const emitBody = (): void => {
    for (const node of layout.nodes) {
      emitRenderNode(code, node, context, slots, stringIndex, diagnostics);
    }
  };

  if (layout.show) {
    emitConditional(code, layout.show, context, slots, diagnostics, () => {
      if (layout.stale && layout.stale.style === "dim") {
        const staleSource = context.resolve.sources[0]?.id;
        const staleSlot = staleSource ? slots.reserveComputed(`${staleSource}.$stale`, "int", staleSource) : null;
        if (staleSource && staleSlot !== null) {
          code.writeU8(OPCODES.JMPSTALE);
          code.writeU8(staleSlot);
          code.writeU16(layout.stale.afterMs);
          const staleJump = code.length;
          code.writeU16(0);
          emitBody();
          code.writeU8(OPCODES.JMP);
          const endJump = code.length;
          code.writeU16(0);
          code.patchU16(staleJump, code.length);
          code.writeU8(OPCODES.PUSHDIM);
          code.writeU8(50);
          emitBody();
          code.writeU8(OPCODES.POPDIM);
          code.patchU16(endJump, code.length);
        } else {
          emitBody();
        }
      } else {
        emitBody();
      }
    });
  } else if (layout.stale && layout.stale.style === "dim" && context.resolve.sources[0]?.id) {
    const staleSource = context.resolve.sources[0]?.id;
    const staleSlot = staleSource ? slots.reserveComputed(`${staleSource}.$stale`, "int", staleSource) : null;
    if (staleSource && staleSlot !== null) {
      code.writeU8(OPCODES.JMPSTALE);
      code.writeU8(staleSlot);
      code.writeU16(layout.stale.afterMs);
      const staleJump = code.length;
      code.writeU16(0);
      emitBody();
      code.writeU8(OPCODES.JMP);
      const endJump = code.length;
      code.writeU16(0);
      code.patchU16(staleJump, code.length);
      code.writeU8(OPCODES.PUSHDIM);
      code.writeU8(50);
      emitBody();
      code.writeU8(OPCODES.POPDIM);
      code.patchU16(endJump, code.length);
    } else {
      emitBody();
    }
  } else {
    emitBody();
  }

  code.writeU8(OPCODES.HALT);

  const stringTable = emitStringTable(strings);
  const codeOffset = HEADER_SIZE + stringTable.length;
  const payload = new Uint8Array(stringTable.length + code.bytes.length);
  payload.set(stringTable, 0);
  payload.set(new Uint8Array(code.bytes), stringTable.length);

  const bytecode = new Uint8Array(HEADER_SIZE + payload.length);
  bytecode.set(utf8Bytes("MXR1"), 0);
  const headerView = new DataView(bytecode.buffer);
  headerView.setUint16(4, VERSION, true);
  headerView.setUint16(6, (layout.nodes.some((node) => node.kind === "group" && node.blinkRateMs !== undefined) ? 1 : 0), true);
  headerView.setUint8(8, slots.slotMap.length);
  headerView.setUint8(9, 0);
  headerView.setUint16(10, HEADER_SIZE, true);
  headerView.setUint16(12, codeOffset, true);
  headerView.setUint16(14, code.bytes.length, true);
  bytecode.set(payload, HEADER_SIZE);
  headerView.setUint32(16, crc32(bytecode.slice(HEADER_SIZE)), true);

  return {
    bytecode,
    diagnostics,
    estimatedAmps,
    slotMap: slots.slotMap,
    sources: context.resolve.sources.map((source) => source.id)
  };
}
