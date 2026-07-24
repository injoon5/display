const NAMED_COLORS: Record<string, string> = {
  aqua: "#00ffff",
  black: "#000000",
  blue: "#0000ff",
  cyan: "#00ffff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  green: "#008000",
  lime: "#00ff00",
  magenta: "#ff00ff",
  maroon: "#800000",
  navy: "#000080",
  olive: "#808000",
  purple: "#800080",
  red: "#ff0000",
  silver: "#c0c0c0",
  teal: "#008080",
  white: "#ffffff",
  yellow: "#ffff00"
};

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function rgb565(input: string | RgbColor): number {
  const rgb = typeof input === "string" ? parseColor(input) : input;
  return ((rgb.r >> 3) << 11) | ((rgb.g >> 2) << 5) | (rgb.b >> 3);
}

export function parseColor(value: string): RgbColor {
  const normalized = value.trim().toLowerCase();
  const hex = NAMED_COLORS[normalized] ?? normalized;
  if (!hex.startsWith("#")) {
    throw new Error(`Unsupported colour literal: ${value}`);
  }

  if (hex.length === 4) {
    return {
      r: Number.parseInt(hex[1] + hex[1], 16),
      g: Number.parseInt(hex[2] + hex[2], 16),
      b: Number.parseInt(hex[3] + hex[3], 16)
    };
  }

  if (hex.length === 7) {
    return {
      r: Number.parseInt(hex.slice(1, 3), 16),
      g: Number.parseInt(hex.slice(3, 5), 16),
      b: Number.parseInt(hex.slice(5, 7), 16)
    };
  }

  throw new Error(`Unsupported colour literal: ${value}`);
}

export function normaliseColorLiteral(value: string): string {
  const { r, g, b } = parseColor(value);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
