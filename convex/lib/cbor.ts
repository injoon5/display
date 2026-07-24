type CborValue =
  | null
  | boolean
  | number
  | string
  | CborValue[]
  | { [key: string]: CborValue };

function concatArrays(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeTypeAndLength(majorType: number, length: number): Uint8Array {
  if (length < 24) {
    return Uint8Array.of((majorType << 5) | length);
  }
  if (length < 256) {
    return Uint8Array.of((majorType << 5) | 24, length);
  }
  if (length < 65536) {
    return Uint8Array.of((majorType << 5) | 25, length >> 8, length & 0xff);
  }
  return Uint8Array.of(
    (majorType << 5) | 26,
    (length >>> 24) & 0xff,
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
  );
}

function encodeUnsignedInteger(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Only non-negative integers are supported");
  }
  return encodeTypeAndLength(0, value);
}

function encodeNegativeInteger(value: number): Uint8Array {
  if (!Number.isInteger(value) || value >= 0) {
    throw new Error("Only negative integers are supported");
  }
  return encodeTypeAndLength(1, -1 - value);
}

function encodeFloat64(value: number): Uint8Array {
  const bytes = new Uint8Array(9);
  bytes[0] = 0xfb;
  new DataView(bytes.buffer).setFloat64(1, value, false);
  return bytes;
}

function encodeNumber(value: number): Uint8Array {
  if (Number.isInteger(value)) {
    return value >= 0 ? encodeUnsignedInteger(value) : encodeNegativeInteger(value);
  }
  return encodeFloat64(value);
}

function encodeString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  return concatArrays([encodeTypeAndLength(3, bytes.length), bytes]);
}

function encodeArray(value: CborValue[]): Uint8Array {
  const parts = value.map((item) => encodeCborValue(item));
  return concatArrays([encodeTypeAndLength(4, value.length), ...parts]);
}

function encodeObject(value: { [key: string]: CborValue }): Uint8Array {
  const entries = Object.entries(value);
  const parts: Uint8Array[] = [encodeTypeAndLength(5, entries.length)];
  for (const [key, entryValue] of entries) {
    parts.push(encodeString(key), encodeCborValue(entryValue));
  }
  return concatArrays(parts);
}

function encodeCborValue(value: CborValue): Uint8Array {
  if (value === null) {
    return Uint8Array.of(0xf6);
  }
  if (typeof value === "boolean") {
    return Uint8Array.of(value ? 0xf5 : 0xf4);
  }
  if (typeof value === "number") {
    return encodeNumber(value);
  }
  if (typeof value === "string") {
    return encodeString(value);
  }
  if (Array.isArray(value)) {
    return encodeArray(value);
  }
  return encodeObject(value);
}

function isEncodable(value: unknown): value is CborValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((item) => isEncodable(item));
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every((item) => isEncodable(item));
  }
  return false;
}

export function encodeSlotFrame(frame: Record<string, unknown>): {
  body: Uint8Array;
  contentType: string;
} {
  if (isEncodable(frame)) {
    return {
      body: encodeCborValue(frame),
      contentType: "application/cbor",
    };
  }

  return {
    body: new TextEncoder().encode(JSON.stringify({ kind: "json-fallback", frame })),
    contentType: "application/json",
  };
}
