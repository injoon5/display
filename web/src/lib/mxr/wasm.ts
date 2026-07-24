/**
 * Thin Emscripten glue for libmxr.
 *
 * mxr_ctx_t layout (wasm32, see mxr.h / offsetof under emcc):
 *   0  fb            uint16_t*
 *   4  program       const uint8_t*
 *   8  slots         const mxr_slot_t*
 *  12  assets        const mxr_asset_t*
 *  16  t_ms          uint32_t
 *  20  program_len   size_t
 *  24  scratch[256]  uint8_t
 * sizeof = 280
 *
 * mxr_slot_t (12 bytes):
 *   0  kind          int32 (mxr_slot_kind_t)
 *   4  updated_ms    uint32
 *   8  as            union { i32 | f32 | char* | u16 color | u8 b }
 */

const WIDTH = 64;
const HEIGHT = 32;
const FB_PIXELS = WIDTH * HEIGHT;
const CTX_SIZE = 280;
const SLOT_SIZE = 12;
const MAX_SLOTS = 64;

const MXR_SLOT_NULL = 0;
const MXR_SLOT_INT = 1;
const MXR_SLOT_FLOAT = 2;
const MXR_SLOT_STR = 3;
const MXR_SLOT_COLOR = 4;
const MXR_SLOT_BOOL = 5;

export type WasmSlotValue = {
  type?: string;
  updatedMs?: number;
  value: unknown;
};

type MxrModule = {
  HEAP32: Int32Array;
  HEAPU16: Uint16Array;
  HEAPU8: Uint8Array;
  _free: (ptr: number) => void;
  _malloc: (size: number) => number;
  _mxr_render: (ctxPtr: number) => number;
  _mxr_validate?: (programPtr: number, len: number, diagPtr: number) => number;
};

type MxrFactory = (config?: {
  locateFile?: (path: string, scriptDirectory: string) => string;
}) => Promise<MxrModule>;

let modulePromise: Promise<MxrModule | null> | null = null;
let mxrModule: MxrModule | null = null;

function locateWasm(path: string): string {
  if (path.endsWith(".wasm")) {
    return "/mxr/mxr.wasm";
  }
  return path;
}

function resolveFactory(mod: Record<string, unknown>): MxrFactory | null {
  const candidate = mod.default ?? mod.Module ?? mod;
  if (typeof candidate === "function") {
    return candidate as MxrFactory;
  }
  return null;
}

async function loadModule(): Promise<MxrModule | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const imported = (await import("./generated/mxr.js")) as Record<string, unknown>;
    const factory = resolveFactory(imported);
    if (!factory) {
      return null;
    }
    const instance = await factory({ locateFile: locateWasm });
    if (
      !instance ||
      typeof instance._malloc !== "function" ||
      typeof instance._mxr_render !== "function" ||
      !instance.HEAPU8
    ) {
      return null;
    }
    return instance;
  } catch {
    return null;
  }
}

/** Load the WASM module once. Safe to call repeatedly; failures are silent. */
export async function initMxrWasm(): Promise<boolean> {
  if (mxrModule) {
    return true;
  }
  if (!modulePromise) {
    modulePromise = loadModule().then((instance) => {
      mxrModule = instance;
      return instance;
    });
  }
  const instance = await modulePromise;
  return instance !== null;
}

export function isMxrWasmReady(): boolean {
  return mxrModule !== null;
}

function writeU32(heap: Uint8Array, offset: number, value: number): void {
  heap[offset] = value & 0xff;
  heap[offset + 1] = (value >>> 8) & 0xff;
  heap[offset + 2] = (value >>> 16) & 0xff;
  heap[offset + 3] = (value >>> 24) & 0xff;
}

function writeI32(heap: Uint8Array, offset: number, value: number): void {
  writeU32(heap, offset, value | 0);
}

function writeF32(heap: Uint8Array, offset: number, value: number): void {
  const view = new DataView(heap.buffer, heap.byteOffset + offset, 4);
  view.setFloat32(0, value, true);
}

function writePtr(mod: MxrModule, offset: number, ptr: number): void {
  writeU32(mod.HEAPU8, offset, ptr >>> 0);
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function slotKindFromValue(slot: WasmSlotValue | undefined): number {
  if (!slot || slot.value === null || slot.value === undefined) {
    return MXR_SLOT_NULL;
  }
  const type = (slot.type ?? "").toLowerCase();
  if (type === "int" || type === "integer") {
    return MXR_SLOT_INT;
  }
  if (type === "float" || type === "number") {
    return typeof slot.value === "number" && Number.isInteger(slot.value)
      ? MXR_SLOT_INT
      : MXR_SLOT_FLOAT;
  }
  if (type === "str" || type === "string") {
    return MXR_SLOT_STR;
  }
  if (type === "bool" || type === "boolean") {
    return MXR_SLOT_BOOL;
  }
  if (type === "color") {
    return MXR_SLOT_COLOR;
  }

  if (typeof slot.value === "boolean") {
    return MXR_SLOT_BOOL;
  }
  if (typeof slot.value === "number") {
    return Number.isInteger(slot.value) ? MXR_SLOT_INT : MXR_SLOT_FLOAT;
  }
  if (typeof slot.value === "string") {
    return MXR_SLOT_STR;
  }
  return MXR_SLOT_NULL;
}

function allocBytes(mod: MxrModule, bytes: Uint8Array): number {
  const ptr = mod._malloc(bytes.length);
  if (!ptr) {
    throw new Error("mxr wasm malloc failed");
  }
  mod.HEAPU8.set(bytes, ptr);
  return ptr;
}

function allocZero(mod: MxrModule, size: number): number {
  const ptr = mod._malloc(size);
  if (!ptr) {
    throw new Error("mxr wasm malloc failed");
  }
  mod.HEAPU8.fill(0, ptr, ptr + size);
  return ptr;
}

function freeAll(mod: MxrModule, ptrs: number[]): void {
  for (const ptr of ptrs) {
    if (ptr) {
      mod._free(ptr);
    }
  }
}

function programSlotCount(bytecode: Uint8Array): number {
  if (bytecode.length < 9) {
    return 0;
  }
  return bytecode[8] ?? 0;
}

function writeSlot(
  mod: MxrModule,
  slotPtr: number,
  slot: WasmSlotValue | undefined,
  stringPtrs: number[],
): void {
  const kind = slotKindFromValue(slot);
  let strPtr = 0;

  // Allocate string storage before any HEAP writes — malloc may grow memory
  // and refresh HEAPU8 / HEAP32 views.
  if (slot && kind === MXR_SLOT_STR) {
    const text = String(slot.value ?? "");
    const encoded = encodeUtf8(text);
    const withNul = new Uint8Array(encoded.length + 1);
    withNul.set(encoded);
    strPtr = allocBytes(mod, withNul);
    stringPtrs.push(strPtr);
  }

  const heap = mod.HEAPU8;
  heap.fill(0, slotPtr, slotPtr + SLOT_SIZE);
  writeI32(heap, slotPtr, kind);
  writeU32(heap, slotPtr + 4, (slot?.updatedMs ?? 0) >>> 0);

  if (!slot || kind === MXR_SLOT_NULL) {
    return;
  }

  switch (kind) {
    case MXR_SLOT_INT: {
      const value = typeof slot.value === "number" ? slot.value : Number(slot.value);
      writeI32(heap, slotPtr + 8, Number.isFinite(value) ? value | 0 : 0);
      break;
    }
    case MXR_SLOT_FLOAT: {
      const value = typeof slot.value === "number" ? slot.value : Number(slot.value);
      writeF32(heap, slotPtr + 8, Number.isFinite(value) ? value : 0);
      break;
    }
    case MXR_SLOT_BOOL: {
      const truthy =
        typeof slot.value === "boolean"
          ? slot.value
          : slot.value === 1 || slot.value === "1" || slot.value === "true";
      heap[slotPtr + 8] = truthy ? 1 : 0;
      break;
    }
    case MXR_SLOT_COLOR: {
      let color = 0;
      if (typeof slot.value === "number") {
        color = slot.value & 0xffff;
      } else if (typeof slot.value === "string") {
        const parsed = Number.parseInt(slot.value.replace(/^#/, ""), 16);
        color = Number.isFinite(parsed) ? parsed & 0xffff : 0;
      }
      heap[slotPtr + 8] = color & 0xff;
      heap[slotPtr + 9] = (color >>> 8) & 0xff;
      break;
    }
    case MXR_SLOT_STR: {
      writePtr(mod, slotPtr + 8, strPtr);
      break;
    }
    default: {
      break;
    }
  }
}

/**
 * Render bytecode via libmxr WASM.
 * Returns a 64×32 RGB565 framebuffer, or null on any failure (caller falls back to TS).
 */
export function renderWithWasm(
  bytecode: Uint8Array,
  slots?: Record<number, WasmSlotValue>,
  tMs = 0,
): Uint16Array | null {
  const mod = mxrModule;
  if (!mod) {
    return null;
  }

  const toFree: number[] = [];
  try {
    const programPtr = allocBytes(mod, bytecode);
    toFree.push(programPtr);

    const fbPtr = allocZero(mod, FB_PIXELS * 2);
    toFree.push(fbPtr);

    let slotsPtr = 0;
    const slotCount = Math.min(MAX_SLOTS, Math.max(programSlotCount(bytecode), 0));
    if (slotCount > 0 && slots) {
      slotsPtr = allocZero(mod, slotCount * SLOT_SIZE);
      toFree.push(slotsPtr);
      const stringPtrs: number[] = [];
      for (let index = 0; index < slotCount; index += 1) {
        writeSlot(mod, slotsPtr + index * SLOT_SIZE, slots[index], stringPtrs);
      }
      toFree.push(...stringPtrs);
    }

    const ctxPtr = allocZero(mod, CTX_SIZE);
    toFree.push(ctxPtr);

    writePtr(mod, ctxPtr + 0, fbPtr);
    writePtr(mod, ctxPtr + 4, programPtr);
    writePtr(mod, ctxPtr + 8, slotsPtr);
    writePtr(mod, ctxPtr + 12, 0);
    writeU32(mod.HEAPU8, ctxPtr + 16, tMs >>> 0);
    writeU32(mod.HEAPU8, ctxPtr + 20, bytecode.byteLength >>> 0);
    // scratch[256] already zeroed

    const rc = mod._mxr_render(ctxPtr);
    if (rc !== 0) {
      return null;
    }

    const framebuffer = new Uint16Array(FB_PIXELS);
    // HEAPU16 is indexed in uint16 units; fbPtr is a byte address.
    const heapU16 = mod.HEAPU16;
    const start = fbPtr >>> 1;
    framebuffer.set(heapU16.subarray(start, start + FB_PIXELS));
    return framebuffer;
  } catch {
    return null;
  } finally {
    freeAll(mod, toFree);
  }
}
