#!/usr/bin/env node
/**
 * Compile every cards/*.card (MXML — the canonical, deployed form) and render
 * through native libmxr render_ppm with sample slot data, then emit scaled-up
 * PNGs and a contact sheet so we can eyeball legibility + design.
 *
 * Animated cards (kind="fx ...") are rendered as a horizontal filmstrip of
 * frames advancing t-ms so motion is visible in a still image.
 *
 * Not part of the build — a local design aid.
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

// Sample values keyed by binding expression (exact) or base path (fallback).
const SAMPLE = {
  // current + upcoming weather
  "wx.tempC": ["int", 23],
  "wx.tempC | round": ["int", 23],
  "wx.condition": ["str", "CLOUDY"],
  "wx.condition | upper | trunc(10)": ["str", "CLOUDY"],
  "wx.icon": ["int", 2],
  // air
  "air.pm25": ["int", 42],
  "air.grade": ["str", "GOOD"],
  "air.grade | upper | trunc(10)": ["str", "GOOD"],
  // indoor
  "room.temp_c": ["int", 22],
  "room.temp_c | round": ["int", 22],
  "room.humidity": ["int", 41],
  "room.humidity | round": ["int", 41],
  // clock
  "now.hhmm": ["str", "14:52"],
  // bus
  "bus.eta_min": ["int", 3],
  "bus.next_eta_min": ["int", 10],
  "bus.next_eta_min | default('--')": ["int", 10],
  "bus.eta2_min": ["int", 8],
  "bus.next2_eta_min": ["int", 21],
  "bus.eta3_min": ["int", 12],
  "bus.next3_eta_min": ["int", 27],
  "bus.crowding": ["int", 2],
  // calendar
  "calendar.next.title | trunc(10)": ["str", "Standup"],
  "calendar.next.countdownMin": ["int", 15],
  "calendar.next.startsAt | default(\"TBD\")": ["str", "TBD"],
  // self status
  "telemetry.rssi": ["int", -42],
  "telemetry.uptime_s | default(0) | duration": ["str", "6d 4h"],
  "device.programVersion": ["int", 7],
  "device.fwVersion | trunc(6)": ["str", "1.2.0"],
  // bike share
  "bike.dock1.name | upper | trunc(9)": ["str", "CITY HALL"],
  "bike.dock1.bikes": ["int", 7],
  "bike.dock2.name | upper | trunc(9)": ["str", "SEOUL STN"],
  "bike.dock2.bikes": ["int", 3],
  // now playing
  "np.title | trunc(10)": ["str", "Bad Habit"],
  "np.artist | trunc(10)": ["str", "Steve Lacy"],
  "np.progress_pct": ["int", 62],
  // fx / krw / etc are static-drawn or fx; no binds
  // year progress / dday
  "year.pct": ["int", 56],
  "dday.days": ["int", 128],
};

function resolveSlot(pathExpr) {
  if (SAMPLE[pathExpr]) return SAMPLE[pathExpr];
  // Computed template slot, e.g. "template:{{ bus.eta_min }}m" — evaluate parts.
  if (pathExpr.includes("{{")) {
    const s = pathExpr.replace(/^template:/, "").replace(/\{\{([^}]+)\}\}/g, (_, inner) => {
      const v = resolveSlot(inner.trim());
      return v ? String(v[1]) : "";
    });
    return ["str", s];
  }
  if (pathExpr.endsWith("$stale")) return ["int", 0];
  if (/!=\s*null/.test(pathExpr)) return ["bool", 1];
  if (/==\s*null/.test(pathExpr)) return ["bool", 0];
  const base = pathExpr.split(/\s*[|=<>!]/)[0].trim();
  if (SAMPLE[base]) return SAMPLE[base];
  return null;
}

function slotsFor(slotMap) {
  const lines = ["# index kind updated_ms value"];
  for (const entry of slotMap) {
    const v = resolveSlot(entry.path);
    if (!v) {
      lines.push(`${entry.index} null 0`);
      continue;
    }
    lines.push(`${entry.index} ${v[0]} 0 ${v[1]}`);
  }
  return lines.join("\n") + "\n";
}

function readPpm(path) {
  const buf = readFileSync(path);
  let pos = 0;
  const token = () => {
    while (buf[pos] === 0x20 || buf[pos] === 0x0a || buf[pos] === 0x09) pos++;
    const start = pos;
    while (pos < buf.length && buf[pos] !== 0x20 && buf[pos] !== 0x0a && buf[pos] !== 0x09) pos++;
    return buf.toString("ascii", start, pos);
  };
  token(); // P6
  const w = parseInt(token(), 10);
  const h = parseInt(token(), 10);
  token(); // maxval
  pos++;
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
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

// Upscale a 64x32 frame into an RGB tile with a subtle LED grid.
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

function renderCard(name, source, { frames = 1, step = 220 } = {}) {
  const result = compile(source);
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  if (errors.length) {
    console.error(name, errors.map((e) => e.message));
    return null;
  }
  const mxrPath = join(outDir, `${name}.mxr`);
  const slotsPath = join(outDir, `${name}.slots.txt`);
  writeFileSync(mxrPath, result.bytecode);
  writeFileSync(slotsPath, slotsFor(result.slotMap));
  const tiles = [];
  for (let f = 0; f < frames; f++) {
    const ppmPath = join(outDir, `${name}.${f}.ppm`);
    const r = spawnSync(renderBin, [mxrPath, ppmPath, "--slots", slotsPath, "--t-ms", String(f * step)], { encoding: "utf8" });
    if (r.status !== 0) {
      console.error(name, r.stdout, r.stderr);
      return null;
    }
    tiles.push(renderTile(readPpm(ppmPath), SCALE, GAP));
  }
  return tiles;
}

const SCALE = 8;
const GAP = 1;
const tileW = 64 * SCALE;
const tileH = 32 * SCALE;

const files = readdirSync(cardsDir).filter((n) => n.endsWith(".card")).sort();
const cards = [];
for (const name of files) {
  const source = readFileSync(join(cardsDir, name), "utf8");
  const animated = /kind="fx/.test(source) || /\bfx\b/.test(source);
  const tiles = renderCard(name, source, animated ? { frames: 4 } : {});
  if (!tiles) continue;
  cards.push({ name, tiles, animated });
  // per-card png: filmstrip for animated, single otherwise
  if (tiles.length === 1) {
    writeFileSync(join(outDir, `${name}.png`), encodePng(tiles[0].data, tileW, tileH));
  } else {
    const pad = 8;
    const w = tiles.length * tileW + (tiles.length - 1) * pad;
    const strip = Buffer.alloc(w * tileH * 3).fill(0);
    tiles.forEach((t, i) => blit(strip, w, t, i * (tileW + pad), 0));
    writeFileSync(join(outDir, `${name}.png`), encodePng(strip, w, tileH));
  }
}

// Contact sheet: 2 columns of first-frame tiles.
const cols = 2;
const pad = 16;
const labelH = 6;
const cellW = tileW + pad;
const cellH = tileH + labelH + pad;
const rows = Math.ceil(cards.length / cols);
const sheetW = cols * cellW + pad;
const sheetH = rows * cellH + pad;
const sheet = Buffer.alloc(sheetW * sheetH * 3);
for (let i = 0; i < sheet.length; i += 3) { sheet[i] = 18; sheet[i + 1] = 18; sheet[i + 2] = 20; }
cards.forEach((c, idx) => {
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  blit(sheet, sheetW, c.tiles[0], pad + col * cellW, pad + row * cellH + labelH);
});
writeFileSync(join(outDir, "contact-sheet.png"), encodePng(sheet, sheetW, sheetH));
console.log(`wrote contact-sheet.png ${sheetW}x${sheetH}`);
console.log("cards:", cards.map((c) => c.name.replace(".card", "") + (c.animated ? "*" : "")).join(", "));
