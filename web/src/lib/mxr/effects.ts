/**
 * TS fallback for MXR_OP_FX (0x70). Ports the libmxr graph effect closely;
 * other kinds get compact approximations so FX cards don't blank the preview.
 */

const WIDTH = 64;
const HEIGHT = 32;

function clamp8(value: number): number {
  return Math.max(0, Math.min(255, value | 0));
}

function packRgb565(r: number, g: number, b: number): number {
  const rr = clamp8(r);
  const gg = clamp8(g);
  const bb = clamp8(b);
  return ((rr >> 3) << 11) | ((gg >> 2) << 5) | (bb >> 3);
}

function hash32(x: number): number {
  let v = x >>> 0;
  v ^= v >>> 16;
  v = Math.imul(v, 0x7feb352d) >>> 0;
  v ^= v >>> 15;
  v = Math.imul(v, 0x846ca68b) >>> 0;
  v ^= v >>> 16;
  return v >>> 0;
}

function hash2(a: number, b: number, seed: number): number {
  return hash32(
    (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2654435761)) >>> 0,
  );
}

function frand(h: number): number {
  return (h & 0xffffff) / 0xffffff;
}

function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = frand(hash2(xi, yi, seed));
  const b = frand(hash2(xi + 1, yi, seed));
  const c = frand(hash2(xi, yi + 1, seed));
  const d = frand(hash2(xi + 1, yi + 1, seed));
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function px(fb: Uint16Array, x: number, y: number, color: number): void {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  fb[y * WIDTH + x] = color;
}

function fxGraph(
  fb: Uint16Array,
  ox: number,
  oy: number,
  w: number,
  h: number,
  _color: number,
  arg: number,
): void {
  const up = arg ? 1 : 0;
  const lr = up ? 60 : 240;
  const lg = up ? 210 : 90;
  const lb = up ? 120 : 80;
  const n = Math.min(w, 128);
  const ys = new Float32Array(n);
  let prev = 0.5;
  for (let i = 0; i < n; i += 1) {
    const trend = up ? (i / n) * 0.5 : (1 - i / n) * 0.5;
    const noise = vnoise(i * 0.18, 0, 31) * 0.5;
    const value = 0.2 + trend + noise * 0.55;
    prev = prev * 0.6 + value * 0.4;
    ys[i] = prev;
  }
  for (let i = 0; i < n; i += 1) {
    let gy = oy + h - 2 - Math.floor(ys[i]! * (h - 5));
    if (gy < oy) gy = oy;
    for (let y = gy; y < oy + h; y += 1) {
      let f = 1 - (y - gy) / (oy + h - gy + 1);
      f *= 0.55;
      px(fb, ox + i, y, packRgb565(lr * f * 0.4, lg * f, lb * f));
    }
  }
  for (let i = 0; i < n; i += 1) {
    let gy = oy + h - 2 - Math.floor(ys[i]! * (h - 5));
    if (gy < oy) gy = oy;
    px(fb, ox + i, gy, packRgb565(lr, lg, lb));
    px(fb, ox + i, gy - 1, packRgb565(lr, lg, lb));
  }
}

function fxMatrix(fb: Uint16Array, ox: number, oy: number, w: number, h: number, tMs: number): void {
  const t = tMs * 0.001;
  for (let cx = 0; cx < w; cx += 2) {
    const hc = hash2(cx, 3, 9);
    const sp = 10 + (hc & 31);
    const len = 8 + ((hc >> 5) & 15);
    const head = ((t * sp + frand(hc) * (h + len)) % (h + len) + (h + len)) % (h + len);
    for (let k = 0; k < len; k += 1) {
      const yy = head - k;
      if (yy < 0 || yy >= h) continue;
      const y = oy + (yy | 0);
      if (k === 0) {
        px(fb, ox + cx, y, packRgb565(200, 255, 210));
      } else {
        let g = Math.floor(230 * (1 - k / len));
        if ((hash2(cx, yy | 0, (t * 8) | 0) & 7) === 0) g += 40;
        px(fb, ox + cx, y, packRgb565(g / 6, g, g / 5));
      }
    }
  }
}

function fxStarfield(fb: Uint16Array, ox: number, oy: number, w: number, h: number, tMs: number): void {
  const cx = ox + w * 0.5;
  const cy = oy + h * 0.5;
  const t = tMs * 0.001;
  const maxr = Math.max(w, h) * 0.62;
  for (let i = 0; i < 60; i += 1) {
    const hs = hash2(i, 17, 3);
    const ang = ((hs & 2047) / 2047) * Math.PI * 2;
    const sp = 10 + ((hs >> 11) & 63);
    const ph = ((hs >> 17) & 1023) / 1023;
    const r = ((ph * maxr + t * sp) % maxr + maxr) % maxr;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const bright = (r / maxr) * 255;
    const b2i = 120 + (r / maxr) * 135;
    const steps = 1 + ((r / maxr) * 4) | 0;
    for (let s = 0; s <= steps; s += 1) {
      const rr = r - s * 0.9;
      if (rr < 0) break;
      const fade = bright - s * 40;
      px(fb, (cx + ca * rr) | 0, (cy + sa * rr * 0.85) | 0, packRgb565(fade, fade, b2i - s * 40));
    }
  }
}

function fxFire(fb: Uint16Array, ox: number, oy: number, w: number, h: number, tMs: number): void {
  const t = tMs * 0.001;
  for (let yy = 0; yy < h; yy += 1) {
    const by = h <= 1 ? 1 : yy / (h - 1);
    const base = by ** 1.7;
    for (let xx = 0; xx < w; xx += 1) {
      const n = vnoise(xx * 0.3, (h - yy) * 0.3 + t * 4.5, 5);
      const col = vnoise(xx * 0.5 + 2, t * 1.8, 8);
      const heat = base * (0.35 + 1.1 * n) * (0.5 + 0.62 * col);
      const hv = (heat * 205) | 0;
      if (hv < 24) continue;
      px(fb, ox + xx, oy + yy, packRgb565(hv * 2 + 28, (hv - 82) * 2, (hv - 180) * 3));
    }
  }
}

function fxRain(
  fb: Uint16Array,
  ox: number,
  oy: number,
  w: number,
  h: number,
  color: number,
  arg: number,
  tMs: number,
): void {
  const t = tMs * 0.001;
  const drops = arg || 40;
  const cr = (color >> 11) & 0x1f;
  const cg = (color >> 5) & 0x3f;
  const cb = color & 0x1f;
  for (let i = 0; i < drops; i += 1) {
    const hi = hash2(i, 5, 7);
    const sp = 24 + (hi & 31);
    const len = 3 + ((hi >> 5) & 3);
    const x = hi % Math.max(1, w);
    const slant = 0.35;
    const y = ((t * sp + frand(hi) * (h + len)) % (h + len) + (h + len)) % (h + len);
    for (let k = 0; k < len; k += 1) {
      const yy = (y | 0) - k;
      const xx = (x + k * slant) | 0;
      if (yy < 0 || yy >= h) continue;
      const f = 255 - k * 60;
      px(
        fb,
        ox + ((xx % w) + w) % w,
        oy + yy,
        packRgb565(((cr << 3) * f) / 255, ((cg << 2) * f) / 255, ((cb << 3) * f) / 255),
      );
    }
  }
}

function fxGrass(
  fb: Uint16Array,
  ox: number,
  oy: number,
  w: number,
  h: number,
  color: number,
  tMs: number,
): void {
  const cell = 4;
  const cols = (w / cell) | 0;
  const rows = (h / cell) | 0;
  const cr = ((color >> 11) & 0x1f) << 3;
  const cg = ((color >> 5) & 0x3f) << 2;
  const cb = (color & 0x1f) << 3;
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      let n = vnoise(c * 0.55, r * 0.7, 21);
      n = n * n;
      const level = (n * 4) | 0;
      const x0 = ox + c * cell;
      const y0 = oy + r * cell;
      if (level <= 0) {
        for (let yy = 0; yy < cell - 1; yy += 1) {
          for (let xx = 0; xx < cell - 1; xx += 1) {
            px(fb, x0 + xx, y0 + yy, packRgb565(24, 30, 28));
          }
        }
        continue;
      }
      const f = 0.28 + level * 0.24;
      const flick = c === cols - 1 && (((tMs / 400 + r) | 0) & 1) ? 30 : 0;
      const fill = packRgb565(cr * f + flick, cg * f + flick, cb * f);
      for (let yy = 0; yy < cell - 1; yy += 1) {
        for (let xx = 0; xx < cell - 1; xx += 1) {
          px(fb, x0 + xx, y0 + yy, fill);
        }
      }
    }
  }
}

function fxMoon(fb: Uint16Array, ox: number, oy: number, w: number, h: number, arg: number): void {
  const phase = arg / 255;
  const cx = ox + w * 0.5;
  const cy = oy + h * 0.5;
  const R = Math.min(w, h) * 0.5 - 1;
  const ca = Math.cos(Math.PI * 2 * phase);
  for (let y = 0; y < h; y += 1) {
    const ny = (oy + y - cy) / R;
    if (ny < -1 || ny > 1) continue;
    const hw = Math.sqrt(Math.max(0, 1 - ny * ny));
    for (let x = 0; x < w; x += 1) {
      const nx = (ox + x - cx) / R;
      if (nx * nx + ny * ny > 1) continue;
      const term = hw * ca;
      const lit = phase < 0.5 ? nx > term : nx < -term;
      if (lit) {
        const glow = (30 * (1 - (nx * nx + ny * ny))) | 0;
        px(fb, ox + x, oy + y, packRgb565(214 + glow, 220 + glow, 190 + glow));
      } else {
        px(fb, ox + x, oy + y, packRgb565(20, 22, 34));
      }
    }
  }
}

function fxWxicon(fb: Uint16Array, ox: number, oy: number, w: number, h: number, arg: number): void {
  const cx = ox + (w / 2) | 0;
  const cy = oy + (h / 2) | 0;
  const sun = packRgb565(255, 200, 60);
  const cloud = packRgb565(200, 210, 220);
  const rain = packRgb565(90, 150, 240);
  // Simple sun / cloud / rain marks by arg
  if (arg === 0 || arg === 1) {
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        if (dx * dx + dy * dy <= 10) px(fb, cx + dx - (arg === 1 ? 3 : 0), cy + dy - (arg === 1 ? 2 : 0), sun);
      }
    }
  }
  if (arg >= 1) {
    for (let dx = -6; dx <= 6; dx += 1) {
      px(fb, cx + dx, cy + 2, cloud);
      px(fb, cx + dx, cy + 3, cloud);
    }
  }
  if (arg >= 2) {
    for (let i = 0; i < 4; i += 1) {
      px(fb, cx - 4 + i * 3, cy + 5, rain);
      px(fb, cx - 4 + i * 3, cy + 6, rain);
    }
  }
}

function fxLife(fb: Uint16Array, ox: number, oy: number, w: number, h: number, color: number, tMs: number): void {
  const cr = ((color >> 11) & 0x1f) << 3;
  const cg = ((color >> 5) & 0x3f) << 2;
  const cb = (color & 0x1f) << 3;
  const gen = (tMs / 150) | 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const alive = (hash2(x, y, gen) & 3) === 0;
      if (alive) px(fb, ox + x, oy + y, packRgb565(cr + 40, cg + 40, cb + 40));
    }
  }
}

function fxVu(fb: Uint16Array, ox: number, oy: number, w: number, h: number, tMs: number): void {
  const t = tMs * 0.001;
  const level = Math.max(0.02, Math.min(1, 0.5 + 0.28 * Math.sin(t * 5.3) + 0.16 * Math.sin(t * 11.7)));
  const barW = Math.max(1, (w * level) | 0);
  for (let x = 0; x < barW; x += 1) {
    const hot = x / w > 0.75;
    const color = hot ? packRgb565(255, 80, 50) : packRgb565(80, 220, 120);
    for (let y = 2; y < h - 2; y += 1) px(fb, ox + x, oy + y, color);
  }
}

function fxFlow(fb: Uint16Array, ox: number, oy: number, w: number, h: number, tMs: number): void {
  const t = tMs * 0.001;
  for (let i = 0; i < 50; i += 1) {
    const hi = hash2(i, 91, 4);
    let x = frand(hi) * w;
    let y = frand(hi >> 8) * h;
    for (let s = 0; s < 12; s += 1) {
      const ang = vnoise(x * 0.09, y * 0.09, 4) * Math.PI * 4 + t * 0.15;
      x += Math.cos(ang);
      y += Math.sin(ang);
      if (x < 0 || x >= w || y < 0 || y >= h) break;
      px(fb, ox + (x | 0), oy + (y | 0), packRgb565(40, 120, 200 - s * 10));
    }
  }
}

/** Dispatch MXR FX kinds — see libmxr/effects.c. */
export function renderFx(
  fb: Uint16Array,
  kind: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  arg: number,
  tMs: number,
): void {
  if (w <= 0 || h <= 0) return;
  switch (kind) {
    case 0:
      fxStarfield(fb, x, y, w, h, tMs);
      break;
    case 1:
      fxMatrix(fb, x, y, w, h, tMs);
      break;
    case 2:
      fxFire(fb, x, y, w, h, tMs);
      break;
    case 3:
      fxLife(fb, x, y, w, h, color, tMs);
      break;
    case 4:
      fxFlow(fb, x, y, w, h, tMs);
      break;
    case 5:
      fxRain(fb, x, y, w, h, color, arg, tMs);
      break;
    case 6:
      fxVu(fb, x, y, w, h, tMs);
      break;
    case 7:
      fxMoon(fb, x, y, w, h, arg);
      break;
    case 8:
      fxGrass(fb, x, y, w, h, color, tMs);
      break;
    case 9:
      fxGraph(fb, x, y, w, h, color, arg);
      break;
    case 10:
      fxWxicon(fb, x, y, w, h, arg);
      break;
    default:
      break;
  }
}
