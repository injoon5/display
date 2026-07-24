/** Minimal 24-bit BMP writer (no dependencies). Browsers display these fine. */

export function rgb565ToBmp(framebuffer: Uint16Array, width: number, height: number): Buffer {
  const rowStride = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowStride * height;
  const fileSize = 54 + pixelBytes;
  const buf = Buffer.alloc(fileSize);

  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // bottom-up
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelBytes, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  for (let y = 0; y < height; y += 1) {
    const srcY = height - 1 - y;
    const rowOffset = 54 + y * rowStride;
    for (let x = 0; x < width; x += 1) {
      const p = framebuffer[srcY * width + x] ?? 0;
      const r = Math.round((((p >> 11) & 0x1f) * 255) / 31);
      const g = Math.round((((p >> 5) & 0x3f) * 255) / 63);
      const b = Math.round(((p & 0x1f) * 255) / 31);
      const i = rowOffset + x * 3;
      buf[i] = b;
      buf[i + 1] = g;
      buf[i + 2] = r;
    }
  }

  return buf;
}

export function readPpmToRgb565(ppm: Buffer): { width: number; height: number; pixels: Uint16Array } {
  let offset = 0;
  const text = ppm.toString("latin1");
  if (!text.startsWith("P6")) {
    throw new Error("expected binary PPM (P6)");
  }

  offset = 2;
  const readToken = (): string => {
    while (offset < text.length) {
      const ch = text[offset]!;
      if (ch === "#") {
        while (offset < text.length && text[offset] !== "\n") {
          offset += 1;
        }
        continue;
      }
      if (/\s/.test(ch)) {
        offset += 1;
        continue;
      }
      break;
    }
    let token = "";
    while (offset < text.length && !/\s/.test(text[offset]!) && text[offset] !== "#") {
      token += text[offset]!;
      offset += 1;
    }
    return token;
  };

  const width = Number(readToken());
  const height = Number(readToken());
  const maxval = Number(readToken());
  if (!Number.isFinite(width) || !Number.isFinite(height) || maxval !== 255) {
    throw new Error("invalid PPM header");
  }
  // Skip single whitespace after maxval
  if (/\s/.test(text[offset] ?? "")) {
    offset += 1;
  }

  const pixels = new Uint16Array(width * height);
  for (let i = 0; i < pixels.length; i += 1) {
    const r = ppm[offset++] ?? 0;
    const g = ppm[offset++] ?? 0;
    const b = ppm[offset++] ?? 0;
    const r5 = Math.round((r * 31) / 255);
    const g6 = Math.round((g * 63) / 255);
    const b5 = Math.round((b * 31) / 255);
    pixels[i] = (r5 << 11) | (g6 << 5) | b5;
  }

  return { width, height, pixels };
}
