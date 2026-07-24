import { rgb565, type SlotMapEntry } from "$lib/compiler";

const WIDTH = 64;
const HEIGHT = 32;
const HEADER_SIZE = 84;

const OPCODES = {
  CLEAR: 0x01,
  FRECT: 0x10,
  RECT: 0x11,
  LINE: 0x12,
  PIXEL: 0x13,
  TEXT: 0x20,
  BLIT: 0x30,
  BLITC: 0x31,
  JMP: 0x40,
  JMPZ: 0x41,
  JMPCMP: 0x42,
  JMPSTALE: 0x43,
  PUSHDIM: 0x52,
  POPDIM: 0x53,
  BLINK: 0x60,
  HALT: 0xff
} as const;

type StageZeroElement = {
  bind?: string;
  bg?: string;
  color?: string;
  fg?: string;
  font?: string;
  h?: number;
  max?: number;
  op: string;
  value?: number | string;
  w?: number;
  x?: number;
  x1?: number;
  x2?: number;
  y?: number;
  y1?: number;
  y2?: number;
};

type StageZeroCard = {
  id: string;
  elements: StageZeroElement[];
};

export type RenderSlotValue = {
  path?: string;
  sourceId?: string;
  type?: string;
  updatedMs?: number;
  value: unknown;
};

export type RenderHotspot = {
  h: number;
  path: string;
  slotIndex: number | null;
  sourceId: string;
  type: string;
  updatedMs?: number;
  value: unknown;
  w: number;
  x: number;
  y: number;
};

export type RenderFrame = {
  framebuffer: Uint16Array;
  height: number;
  hotspots: RenderHotspot[];
  mode: "bytecode" | "stage0";
  warnings: string[];
  width: number;
};

export type RenderInput = {
  bytecode: Uint8Array;
  slotMap: SlotMapEntry[];
  slots?: Record<number, RenderSlotValue>;
  source?: object | string;
  sourceSlots?: Record<string, RenderSlotValue>;
  nowMs: number;
};

type ParsedProgram = {
  code: Uint8Array;
  strings: string[];
  version: number;
};

type TextBounds = {
  h: number;
  w: number;
};

const decoder = new TextDecoder();
const sourceCanvas = typeof document === "undefined" ? null : document.createElement("canvas");
const targetCanvas = typeof document === "undefined" ? null : document.createElement("canvas");

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function decodeRgb565(color: number): { b: number; g: number; r: number } {
  const r = ((color >> 11) & 0x1f) * 255 / 31;
  const g = ((color >> 5) & 0x3f) * 255 / 63;
  const b = (color & 0x1f) * 255 / 31;
  return { b: Math.round(b), g: Math.round(g), r: Math.round(r) };
}

function dimRgb565(color: number, percent: number): number {
  if (percent >= 100) {
    return color;
  }
  const { r, g, b } = decodeRgb565(color);
  const scale = percent / 100;
  return rgb565({
    b: Math.round(b * scale),
    g: Math.round(g * scale),
    r: Math.round(r * scale)
  });
}

function createFramebuffer(): Uint16Array {
  return new Uint16Array(WIDTH * HEIGHT);
}

function setPixel(framebuffer: Uint16Array, x: number, y: number, color: number): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
    return;
  }
  framebuffer[y * WIDTH + x] = color;
}

function fillRect(framebuffer: Uint16Array, x: number, y: number, w: number, h: number, color: number): void {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      setPixel(framebuffer, xx, yy, color);
    }
  }
}

function strokeRect(framebuffer: Uint16Array, x: number, y: number, w: number, h: number, color: number): void {
  for (let xx = x; xx < x + w; xx += 1) {
    setPixel(framebuffer, xx, y, color);
    setPixel(framebuffer, xx, y + h - 1, color);
  }
  for (let yy = y; yy < y + h; yy += 1) {
    setPixel(framebuffer, x, yy, color);
    setPixel(framebuffer, x + w - 1, yy, color);
  }
}

function line(framebuffer: Uint16Array, x0: number, y0: number, x1: number, y1: number, color: number): void {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    setPixel(framebuffer, x0, y0, color);
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    dx = Math.abs(x1 - x0);
    dy = -Math.abs(y1 - y0);
  }
}

function parseProgram(bytecode: Uint8Array): ParsedProgram {
  if (bytecode.length < HEADER_SIZE) {
    throw new Error("Bytecode shorter than MXR header");
  }
  if (decoder.decode(bytecode.slice(0, 4)) !== "MXR1") {
    throw new Error("Bad MXR magic");
  }

  const view = new DataView(bytecode.buffer, bytecode.byteOffset, bytecode.byteLength);
  const version = view.getUint16(4, true);
  const stringOffset = view.getUint16(10, true);
  const codeOffset = view.getUint16(12, true);
  const codeLength = view.getUint16(14, true);
  if (version !== 1) {
    throw new Error(`Unsupported MXR version ${version}`);
  }
  if (stringOffset < HEADER_SIZE || codeOffset < stringOffset || codeOffset + codeLength > bytecode.length) {
    throw new Error("Invalid MXR string/code offsets");
  }

  const strings = parseStringTable(bytecode.slice(stringOffset, codeOffset));
  return {
    code: bytecode.slice(codeOffset, codeOffset + codeLength),
    strings,
    version
  };
}

function parseStringTable(table: Uint8Array): string[] {
  if (table.length === 0) {
    return [];
  }
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
  let offset = 0;
  const count = view.getUint16(offset, true);
  offset += 2;
  const strings: string[] = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 2 > table.length) {
      break;
    }
    const length = view.getUint16(offset, true);
    offset += 2;
    strings.push(decoder.decode(table.slice(offset, offset + length)));
    offset += length;
  }
  return strings;
}

function slotToText(slot: RenderSlotValue | undefined): string {
  const value = slot?.value;
  if (typeof value === "number") {
    return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, "");
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value === null || value === undefined) {
    return "--";
  }
  return String(value);
}

function slotToNumber(slot: RenderSlotValue | undefined): number | null {
  const value = slot?.value;
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
}

function slotTruthy(slot: RenderSlotValue | undefined): boolean {
  const value = slot?.value;
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 0;
  }
  return Boolean(value);
}

function slotUpdatedMs(slot: RenderSlotValue | undefined, nowMs: number): number {
  return slot?.updatedMs ?? nowMs;
}

function offscreenContext(width: number, height: number): CanvasRenderingContext2D | null {
  if (!sourceCanvas) {
    return null;
  }
  sourceCanvas.width = Math.max(1, width);
  sourceCanvas.height = Math.max(1, height);
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

function drawText(
  framebuffer: Uint16Array,
  x: number,
  y: number,
  fontId: number,
  color: number,
  text: string
): TextBounds {
  const scale = 4;
  const fontPx = fontId === 0 ? 5 : fontId === 1 ? 7 : fontId === 2 ? 16 : 18;
  const family = fontId === 3 ? "\"JetBrains Mono\", monospace" : "\"JetBrains Mono\", monospace";
  const estimateWidth = Math.max(1, Math.ceil(text.length * (fontId === 0 ? 4 : fontId === 1 ? 6 : fontId === 2 ? 8 : 10)));
  const estimateHeight = fontId === 0 ? 6 : fontId === 1 ? 7 : fontId === 2 ? 16 : 20;
  const ctx = offscreenContext(estimateWidth * scale + scale * 2, estimateHeight * scale + scale * 2);
  if (!ctx) {
    return { h: estimateHeight, w: estimateWidth };
  }

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.font = `${fontId === 3 ? "700" : "500"} ${fontPx * scale}px ${family}`;
  ctx.fillText(text, 0, 0);
  const metrics = ctx.measureText(text);
  const width = clamp(Math.ceil(metrics.width / scale), 1, WIDTH);
  const height = clamp(estimateHeight, 1, HEIGHT);
  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      let lit = false;
      for (let sy = 0; sy < scale && !lit; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const px = xx * scale + sx;
          const py = yy * scale + sy;
          const alpha = image.data[(py * image.width + px) * 4 + 3] ?? 0;
          if (alpha > 64) {
            lit = true;
            break;
          }
        }
      }
      if (lit) {
        setPixel(framebuffer, x + xx, y + yy, color);
      }
    }
  }

  return { h: height, w: width };
}

function resolveByPath(path: string, sourceSlots: Record<string, RenderSlotValue> | undefined): RenderSlotValue | undefined {
  return sourceSlots?.[path];
}

function hotspotForPath(
  input: {
    path: string;
    rect: { h: number; w: number; x: number; y: number };
    sourceSlots?: Record<string, RenderSlotValue>;
    slotMap: SlotMapEntry[];
    slots: Record<number, RenderSlotValue>;
  }
): RenderHotspot | null {
  const sourceSlot = input.sourceSlots?.[input.path];
  const mappedSlot = input.slotMap.find((entry) => entry.path === input.path);
  const runtimeSlot = mappedSlot ? input.slots[mappedSlot.index] : undefined;
  const value = runtimeSlot?.value ?? sourceSlot?.value;
  if (value === undefined) {
    return null;
  }
  return {
    h: input.rect.h,
    path: input.path,
    slotIndex: mappedSlot?.index ?? null,
    sourceId: mappedSlot?.sourceId ?? sourceSlot?.sourceId ?? input.path.split(".")[0] ?? "unknown",
    type: mappedSlot?.type ?? sourceSlot?.type ?? typeof value,
    updatedMs: runtimeSlot?.updatedMs ?? sourceSlot?.updatedMs,
    value,
    w: input.rect.w,
    x: input.rect.x,
    y: input.rect.y
  };
}

function renderStage0(input: RenderInput): RenderFrame {
  const framebuffer = createFramebuffer();
  const hotspots: RenderHotspot[] = [];
  const warnings: string[] = [];
  const source = typeof input.source === "string" ? JSON.parse(input.source) as StageZeroCard : input.source as StageZeroCard;
  if (!source || !Array.isArray(source.elements)) {
    throw new Error("Stage 0 fallback requires JSON card source");
  }

  for (const element of source.elements) {
    const op = String(element.op);
    switch (op) {
      case "text": {
        const path = typeof element.bind === "string" ? element.bind : null;
        const value = path ? resolveByPath(path, input.sourceSlots) : undefined;
        const text = typeof element.value === "string" || typeof element.value === "number"
          ? String(element.value)
          : slotToText(value);
        const color = rgb565(element.color ?? "#ffffff");
        const bounds = drawText(
          framebuffer,
          Number(element.x ?? 0),
          Number(element.y ?? 0),
          fontNameToId(element.font ?? "5x7"),
          color,
          text
        );
        if (path) {
          const hotspot = hotspotForPath({
            path,
            rect: { ...bounds, x: Number(element.x ?? 0), y: Number(element.y ?? 0) },
            slotMap: input.slotMap,
            slots: input.slots ?? {},
            sourceSlots: input.sourceSlots
          });
          if (hotspot) {
            hotspots.push(hotspot);
          }
        }
        break;
      }
      case "rect":
      case "stroke":
        strokeRect(
          framebuffer,
          Number(element.x ?? 0),
          Number(element.y ?? 0),
          Number(element.w ?? (op === "stroke" ? WIDTH : 0)),
          Number(element.h ?? (op === "stroke" ? HEIGHT : 0)),
          rgb565(element.color ?? "#ffffff")
        );
        break;
      case "frect":
        fillRect(
          framebuffer,
          Number(element.x ?? 0),
          Number(element.y ?? 0),
          Number(element.w ?? 0),
          Number(element.h ?? 0),
          rgb565(element.color ?? "#ffffff")
        );
        break;
      case "line":
        line(
          framebuffer,
          Number(element.x1 ?? 0),
          Number(element.y1 ?? 0),
          Number(element.x2 ?? 0),
          Number(element.y2 ?? 0),
          rgb565(element.color ?? "#ffffff")
        );
        break;
      case "pixel":
        setPixel(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), rgb565(element.color ?? "#ffffff"));
        break;
      case "bar": {
        const x = Number(element.x ?? 0);
        const y = Number(element.y ?? 0);
        const w = Number(element.w ?? 0);
        const h = Number(element.h ?? 0);
        fillRect(framebuffer, x, y, w, h, rgb565(element.bg ?? "#202020"));
        const path = typeof element.bind === "string" ? element.bind : null;
        const value = path ? resolveByPath(path, input.sourceSlots) : undefined;
        const current = typeof element.value === "number" ? element.value : slotToNumber(value) ?? 0;
        const max = typeof element.max === "number" && element.max > 0 ? element.max : 1;
        const fillWidth = clamp(Math.round(w * (current / max)), 0, w);
        fillRect(framebuffer, x, y, fillWidth, h, rgb565(element.color ?? "#33cc66"));
        if (path) {
          const hotspot = hotspotForPath({
            path,
            rect: { h, w, x, y },
            slotMap: input.slotMap,
            slots: input.slots ?? {},
            sourceSlots: input.sourceSlots
          });
          if (hotspot) {
            hotspots.push(hotspot);
          }
        }
        break;
      }
      case "badge": {
        fillRect(
          framebuffer,
          Number(element.x ?? 0),
          Number(element.y ?? 0),
          16,
          7,
          rgb565(element.bg ?? "#000000")
        );
        const path = typeof element.bind === "string" ? element.bind : null;
        const value = path ? resolveByPath(path, input.sourceSlots) : undefined;
        const text = typeof element.value === "string" ? element.value : slotToText(value);
        const bounds = drawText(
          framebuffer,
          Number(element.x ?? 0) + 1,
          Number(element.y ?? 0) + 1,
          fontNameToId(element.font ?? "3x5"),
          rgb565(element.fg ?? "#ffffff"),
          text
        );
        if (path) {
          const hotspot = hotspotForPath({
            path,
            rect: { ...bounds, x: Number(element.x ?? 0), y: Number(element.y ?? 0) },
            slotMap: input.slotMap,
            slots: input.slots ?? {},
            sourceSlots: input.sourceSlots
          });
          if (hotspot) {
            hotspots.push(hotspot);
          }
        }
        break;
      }
      case "icon":
        warnings.push("Icon assets are stubbed in the TypeScript fallback renderer.");
        strokeRect(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), 8, 8, rgb565(element.color ?? "#84cc16"));
        line(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), Number(element.x ?? 0) + 7, Number(element.y ?? 0) + 7, rgb565(element.color ?? "#84cc16"));
        break;
      default:
        warnings.push(`Unsupported Stage 0 op '${op}' in fallback renderer.`);
    }
  }

  return {
    framebuffer,
    height: HEIGHT,
    hotspots,
    mode: "stage0",
    warnings,
    width: WIDTH
  };
}

function fontNameToId(name: string): number {
  switch (name) {
    case "3x5":
      return 0;
    case "5x7":
      return 1;
    case "8x16":
      return 2;
    case "seg7":
      return 3;
    default:
      return 1;
  }
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readI32(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  return view.getInt32(0, true);
}

function renderBytecode(input: RenderInput): RenderFrame {
  const program = parseProgram(input.bytecode);
  const framebuffer = createFramebuffer();
  const hotspots: RenderHotspot[] = [];
  const warnings: string[] = [];
  const slots = input.slots ?? {};
  const dimStack = [100];
  let pc = 0;

  while (pc < program.code.length) {
    const op = program.code[pc]!;
    if (op === OPCODES.HALT) {
      break;
    }
    switch (op) {
      case OPCODES.CLEAR: {
        const color = dimRgb565(readU16(program.code, pc + 1), currentDim(dimStack));
        framebuffer.fill(color);
        pc += 3;
        break;
      }
      case OPCODES.FRECT: {
        fillRect(framebuffer, program.code[pc + 1]!, program.code[pc + 2]!, program.code[pc + 3]!, program.code[pc + 4]!, dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack)));
        pc += 7;
        break;
      }
      case OPCODES.RECT: {
        strokeRect(framebuffer, program.code[pc + 1]!, program.code[pc + 2]!, program.code[pc + 3]!, program.code[pc + 4]!, dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack)));
        pc += 7;
        break;
      }
      case OPCODES.LINE: {
        line(framebuffer, program.code[pc + 1]!, program.code[pc + 2]!, program.code[pc + 3]!, program.code[pc + 4]!, dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack)));
        pc += 7;
        break;
      }
      case OPCODES.PIXEL: {
        setPixel(framebuffer, program.code[pc + 1]!, program.code[pc + 2]!, dimRgb565(readU16(program.code, pc + 3), currentDim(dimStack)));
        pc += 5;
        break;
      }
      case OPCODES.TEXT: {
        const x = program.code[pc + 1]!;
        const y = program.code[pc + 2]!;
        const font = program.code[pc + 3]!;
        const color = dimRgb565(readU16(program.code, pc + 4), currentDim(dimStack));
        const source = program.code[pc + 6]!;
        const slotIndex = source & 0x80 ? source & 0x7f : null;
        const text = slotIndex !== null ? slotToText(slots[slotIndex]) : (program.strings[source] ?? "");
        const bounds = drawText(framebuffer, x, y, font, color, text);
        if (slotIndex !== null) {
          const entry = input.slotMap[slotIndex];
          hotspots.push({
            h: bounds.h,
            path: entry?.path ?? `slot:${slotIndex}`,
            slotIndex,
            sourceId: entry?.sourceId ?? "unknown",
            type: entry?.type ?? "unknown",
            updatedMs: slots[slotIndex]?.updatedMs,
            value: slots[slotIndex]?.value ?? null,
            w: bounds.w,
            x,
            y
          });
        }
        pc += 7;
        break;
      }
      case OPCODES.BLIT:
      case OPCODES.BLITC: {
        const x = program.code[pc + 1]!;
        const y = program.code[pc + 2]!;
        const color = op === OPCODES.BLITC
          ? dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack))
          : rgb565("#84cc16");
        strokeRect(framebuffer, x, y, 8, 8, color);
        line(framebuffer, x, y, x + 7, y + 7, color);
        warnings.push("Asset blits are placeholder outlines in the TypeScript fallback renderer.");
        pc += op === OPCODES.BLITC ? 7 : 5;
        break;
      }
      case OPCODES.JMP:
        pc = readU16(program.code, pc + 1);
        break;
      case OPCODES.JMPZ: {
        const slotIndex = program.code[pc + 1]!;
        const target = readU16(program.code, pc + 2);
        pc = slotTruthy(slots[slotIndex]) ? pc + 4 : target;
        break;
      }
      case OPCODES.JMPCMP: {
        const slotIndex = program.code[pc + 1]!;
        const cmp = program.code[pc + 2]!;
        const imm = readI32(program.code, pc + 3);
        const target = readU16(program.code, pc + 7);
        const value = slotToNumber(slots[slotIndex]);
        const matches = compare(value, imm, cmp);
        pc = matches ? target : pc + 9;
        break;
      }
      case OPCODES.JMPSTALE: {
        const slotIndex = program.code[pc + 1]!;
        const staleMs = readU16(program.code, pc + 2);
        const target = readU16(program.code, pc + 4);
        const age = input.nowMs - slotUpdatedMs(slots[slotIndex], input.nowMs);
        pc = age > staleMs ? target : pc + 6;
        break;
      }
      case OPCODES.PUSHDIM:
        dimStack.push(clamp(program.code[pc + 1]!, 0, 100));
        pc += 2;
        break;
      case OPCODES.POPDIM:
        if (dimStack.length > 1) {
          dimStack.pop();
        }
        pc += 1;
        break;
      case OPCODES.BLINK: {
        const rate = readU16(program.code, pc + 1);
        const duty = program.code[pc + 3]!;
        const target = readU16(program.code, pc + 4);
        const cycle = rate <= 0 ? 1 : input.nowMs % rate;
        const activeWindow = rate <= 0 ? 1 : rate * (duty / 100);
        pc = cycle < activeWindow ? pc + 6 : target;
        break;
      }
      default:
        throw new Error(`Unsupported MXR opcode 0x${op.toString(16)}`);
    }
  }

  return {
    framebuffer,
    height: HEIGHT,
    hotspots,
    mode: "bytecode",
    warnings,
    width: WIDTH
  };
}

function currentDim(stack: number[]): number {
  return stack.reduce((accumulator, value) => Math.round(accumulator * (value / 100)), 100);
}

function compare(left: number | null, right: number, cmp: number): boolean {
  if (left === null) {
    return false;
  }
  switch (cmp) {
    case 0:
      return left === right;
    case 1:
      return left !== right;
    case 2:
      return left < right;
    case 3:
      return left <= right;
    case 4:
      return left > right;
    case 5:
      return left >= right;
    default:
      return false;
  }
}

export function render(input: RenderInput): RenderFrame {
  const looksLikeStage0 =
    typeof input.source === "string" && input.source.trimStart().startsWith("{");
  const hasMxrBytecode =
    input.bytecode !== undefined &&
    input.bytecode.byteLength >= 4 &&
    String.fromCharCode(
      input.bytecode[0] ?? 0,
      input.bytecode[1] ?? 0,
      input.bytecode[2] ?? 0,
      input.bytecode[3] ?? 0,
    ) === "MXR1";

  if (hasMxrBytecode) {
    try {
      return renderBytecode(input);
    } catch (error) {
      return {
        framebuffer: createFramebuffer(),
        height: HEIGHT,
        hotspots: [],
        mode: "bytecode",
        warnings: [
          error instanceof Error ? error.message : "MXR bytecode render failed",
          "Stage0 fallback suppressed when MXR1 bytecode is present",
        ],
        width: WIDTH,
      };
    }
  }

  if (looksLikeStage0 && input.source) {
    return renderStage0(input);
  }

  try {
    return renderBytecode(input);
  } catch (error) {
    return {
      framebuffer: createFramebuffer(),
      height: HEIGHT,
      hotspots: [],
      mode: "bytecode",
      warnings: [error instanceof Error ? error.message : "Unknown renderer error"],
      width: WIDTH,
    };
  }
}

/*
 * Preview strategy until emcc WASM ships (npm run mxr:wasm -w web):
 * the TypeScript bytecode interpreter mirrors libmxr opcodes + the
 * length-prefixed string table. Golden tests compile cards with the
 * shared compiler and validate through native libmxr.
 */


export function blitFramebuffer(canvas: HTMLCanvasElement, framebuffer: Uint16Array, scale = 8): void {
  if (!targetCanvas) {
    return;
  }
  const sourceContext = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) {
    return;
  }
  targetCanvas.width = WIDTH;
  targetCanvas.height = HEIGHT;
  const image = sourceContext.createImageData(WIDTH, HEIGHT);
  for (let index = 0; index < framebuffer.length; index += 1) {
    const { r, g, b } = decodeRgb565(framebuffer[index]!);
    const offset = index * 4;
    image.data[offset] = r;
    image.data[offset + 1] = g;
    image.data[offset + 2] = b;
    image.data[offset + 3] = 255;
  }
  sourceContext.putImageData(image, 0, 0);

  canvas.width = WIDTH * scale;
  canvas.height = HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(targetCanvas, 0, 0, canvas.width, canvas.height);
}

export function locateHotspot(hotspots: RenderHotspot[], x: number, y: number): RenderHotspot | null {
  for (const hotspot of hotspots) {
    if (x >= hotspot.x && x < hotspot.x + hotspot.w && y >= hotspot.y && y < hotspot.y + hotspot.h) {
      return hotspot;
    }
  }
  return null;
}

export const MXR_DIMENSIONS = {
  height: HEIGHT,
  width: WIDTH
} as const;

/*
 * Swap this fallback out for the real libmxr wasm build later:
 *   npm run mxr:wasm -w web
 * The script wraps the ../libmxr Makefile wasm target and copies the generated
 * assets into the web app once emcc is available.
 */
