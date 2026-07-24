const WIDTH = 64;
const HEIGHT = 32;

function decodeRgb565(pixel: number): { r: number; g: number; b: number } {
  return {
    r: Math.round((((pixel >> 11) & 0x1f) * 255) / 31),
    g: Math.round((((pixel >> 5) & 0x3f) * 255) / 63),
    b: Math.round(((pixel & 0x1f) * 255) / 31),
  };
}

export type LedPanelOptions = {
  /** Logical pixel pitch in CSS pixels (cell size including gap). */
  pitch?: number;
  /** LED diameter as fraction of pitch (0–1). */
  fill?: number;
  /** Extra glow bloom for lit LEDs. */
  glow?: boolean;
  /** Apply global brightness 0–100. */
  brightness?: number;
};

/**
 * Paint a 64×32 RGB565 framebuffer as discrete LED dots on a dark PCB —
 * closer to a real HUB75 panel than nearest-neighbour block upscaling.
 */
export function blitLedMatrix(
  canvas: HTMLCanvasElement,
  framebuffer: Uint16Array,
  options: LedPanelOptions = {},
): void {
  const pitch = options.pitch ?? 10;
  const fill = options.fill ?? 0.62;
  const glow = options.glow ?? true;
  const brightness = Math.min(100, Math.max(0, options.brightness ?? 100)) / 100;

  const width = WIDTH * pitch;
  const height = HEIGHT * pitch;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // PCB / mask
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, width, height);

  // Subtle PCB grain / traces
  ctx.fillStyle = "rgba(255,255,255,0.015)";
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if ((x + y) % 7 === 0) {
        ctx.fillRect(x * pitch, y * pitch, 1, pitch);
      }
    }
  }

  const radius = (pitch * fill) / 2;

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const index = y * WIDTH + x;
      const { r, g, b } = decodeRgb565(framebuffer[index] ?? 0);
      const lr = Math.round(r * brightness);
      const lg = Math.round(g * brightness);
      const lb = Math.round(b * brightness);
      const luminance = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / 255;
      const cx = x * pitch + pitch / 2;
      const cy = y * pitch + pitch / 2;

      // Dark LED cup (unlit cavity)
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 0.6, 0, Math.PI * 2);
      ctx.fillStyle = "#0c0c0c";
      ctx.fill();

      if (luminance < 0.02) {
        // Slightly reflective empty LED
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fill();
        continue;
      }

      if (glow && luminance > 0.08) {
        const glowR = radius * (1.6 + luminance * 0.8);
        const gradient = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, glowR);
        gradient.addColorStop(0, `rgba(${lr},${lg},${lb},${0.35 + luminance * 0.35})`);
        gradient.addColorStop(1, `rgba(${lr},${lg},${lb},0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // LED epoxy dome
      const led = ctx.createRadialGradient(
        cx - radius * 0.25,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      led.addColorStop(0, `rgb(${Math.min(255, lr + 40)},${Math.min(255, lg + 40)},${Math.min(255, lb + 40)})`);
      led.addColorStop(0.55, `rgb(${lr},${lg},${lb})`);
      led.addColorStop(1, `rgb(${Math.round(lr * 0.45)},${Math.round(lg * 0.45)},${Math.round(lb * 0.45)})`);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = led;
      ctx.fill();
    }
  }
}

export function matrixPixelFromEvent(
  event: MouseEvent,
  element: HTMLElement,
  _pitch?: number,
): { x: number; y: number } | null {
  const bounds = element.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * WIDTH);
  const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * HEIGHT);
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return null;
  return { x, y };
}

export const LED_MATRIX = {
  width: WIDTH,
  height: HEIGHT,
} as const;
