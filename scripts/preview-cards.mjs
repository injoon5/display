#!/usr/bin/env node
/**
 * Compile every cards/* source, render through native libmxr render_ppm with
 * sample slot data, and emit a scaled-up PNG contact sheet so we can eyeball
 * legibility. Not part of the build — a local design aid.
 */
import { spawnSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@matrix-panel/compiler";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = join(root, "cards");
const outDir = join(root, "tmp", "preview");
mkdirSync(outDir, { recursive: true });

const renderBin = join(root, "libmxr", "render_ppm");
spawnSync("make", ["-C", join(root, "libmxr"), "render_ppm"], { encoding: "utf8" });

// Sample values keyed by binding path, so dynamic cards render like real life.
const SAMPLE = {
  "now.hhmm": ["str", "14:52"],
  "wx.tempC": ["int", 23],
  "wx.condition": ["str", "CLOUDY"],
  "air.pm25": ["int", 42],
  "air.grade": ["str", "GOOD"],
  "bus.eta_min": ["int", 3],
  "bus.next_eta_min": ["int", 8],
  "bus.third_eta_min": ["int", 17],
  "bus.crowding": ["int", 2],
  "calendar.next.title": ["str", "Standup"],
  "calendar.next.countdownMin": ["int", 15],
  "room.temp_c": ["int", 22],
  "room.humidity": ["int", 41],
  "telemetry.rssi": ["int", -42],
  "telemetry.uptime_s": ["int", 86400],
  "device.programVersion": ["int", 7],
  "device.fwVersion": ["str", "1.2.0"],
};

function slotsFor(slotMap) {
  const lines = ["# index kind updated_ms value"];
  for (const entry of slotMap) {
    const sample = SAMPLE[entry.path];
    if (!sample) {
      lines.push(`${entry.index} null 0`);
      continue;
    }
    const [kind, value] = sample;
    lines.push(`${entry.index} ${kind} 0 ${value}`);
  }
  return lines.join("\n") + "\n";
}

function readPpm(path) {
  const buf = readFileSync(path);
  // P6\n<w> <h>\n255\n<binary>
  let pos = 0;
  const token = () => {
    while (buf[pos] === 0x20 || buf[pos] === 0x0a || buf[pos] === 0x09) pos++;
    let start = pos;
    while (pos < buf.length && buf[pos] !== 0x20 && buf[pos] !== 0x0a && buf[pos] !== 0x09) pos++;
    return buf.toString("ascii", start, pos);
  };
  const magic = token();
  const w = parseInt(token(), 10);
  const h = parseInt(token(), 10);
  token(); // maxval
  pos++; // single whitespace after maxval
  return { w, h, data: buf.subarray(pos) };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(rgb, w, h) {
  // rgb: Buffer of w*h*3. Add filter byte 0 per row.
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Render a single 64x32 frame to an upscaled RGB tile with LED grid + label.
function renderTile(ppm, scale, gap) {
  const { w, h, data } = ppm;
  const tw = w * scale;
  const th = h * scale;
  const out = Buffer.alloc(tw * th * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 3;
      const r = data[si], g = data[si + 1], b = data[si + 2];
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          // leave a 1px dark gap between "pixels" for the LED look
          const on = dx < scale - gap && dy < scale - gap;
          const px = x * scale + dx;
          const py = y * scale + dy;
          const oi = (py * tw + px) * 3;
          out[oi] = on ? r : Math.round(r * 0.12);
          out[oi + 1] = on ? g : Math.round(g * 0.12);
          out[oi + 2] = on ? b : Math.round(b * 0.12);
        }
      }
    }
  }
  return { w: tw, h: th, data: out };
}

const files = readdirSync(cardsDir).filter((n) => n.endsWith(".json")).sort();
const scale = 8;
const gap = 1;
const tiles = [];
for (const name of files) {
  const src = JSON.parse(readFileSync(join(cardsDir, name), "utf8"));
  const result = compile(src);
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  if (errors.length) {
    console.error(name, errors);
    continue;
  }
  const mxrPath = join(outDir, `${name}.mxr`);
  const slotsPath = join(outDir, `${name}.slots.txt`);
  const ppmPath = join(outDir, `${name}.ppm`);
  writeFileSync(mxrPath, result.bytecode);
  writeFileSync(slotsPath, slotsFor(result.slotMap));
  const r = spawnSync(renderBin, [mxrPath, ppmPath, "--slots", slotsPath, "--t-ms", "0"], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(name, r.stdout, r.stderr);
    continue;
  }
  const tile = renderTile(readPpm(ppmPath), scale, gap);
  tiles.push({ name: src.name || name, tile });
  // also write the individual png
  writeFileSync(join(outDir, `${name}.png`), encodePng(tile.data, tile.w, tile.h));
}

// Compose a contact sheet: 2 columns, label band above each tile.
const cols = 2;
const pad = 16;
const labelH = 18;
const tileW = 64 * scale;
const tileH = 32 * scale;
const cellW = tileW + pad;
const cellH = tileH + labelH + pad;
const rows = Math.ceil(tiles.length / cols);
const sheetW = cols * cellW + pad;
const sheetH = rows * cellH + pad;
const sheet = Buffer.alloc(sheetW * sheetH * 3);
// dark background
for (let i = 0; i < sheet.length; i += 3) { sheet[i] = 18; sheet[i + 1] = 18; sheet[i + 2] = 20; }

// tiny 5x7 label font (uppercase + basic) — reuse a minimal bitmap
const FONT = {}; // labels drawn as simple filled bars is overkill; skip text, rely on file order
function blit(dst, dstW, tile, ox, oy) {
  for (let y = 0; y < tile.h; y++) {
    for (let x = 0; x < tile.w; x++) {
      const si = (y * tile.w + x) * 3;
      const di = ((oy + y) * dstW + (ox + x)) * 3;
      dst[di] = tile.data[si];
      dst[di + 1] = tile.data[si + 1];
      dst[di + 2] = tile.data[si + 2];
    }
  }
}
tiles.forEach((t, idx) => {
  const c = idx % cols;
  const rw = Math.floor(idx / cols);
  const ox = pad + c * cellW;
  const oy = pad + rw * cellH + labelH;
  blit(sheet, sheetW, t.tile, ox, oy);
});

writeFileSync(join(outDir, "contact-sheet.png"), encodePng(sheet, sheetW, sheetH));
console.log("wrote", join(outDir, "contact-sheet.png"), `${sheetW}x${sheetH}`);
console.log("cards:", tiles.map((t) => t.name).join(", "));
