import type { DataFrame } from "./device-client.js";

/** Convert Convex `/device/data` frame into libmxr render_ppm slots.txt */
export function frameToSlotsText(frame: DataFrame): string {
  const lines = ["# index kind updated_ms value"];
  const keys = new Set([...Object.keys(frame.s ?? {}), ...Object.keys(frame.a ?? {})]);

  for (const key of [...keys].sort((a, b) => Number(a) - Number(b))) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) {
      continue;
    }

    const value = frame.s[key];
    const updatedRaw = frame.a[key];
    const updatedMs =
      typeof updatedRaw === "number"
        ? Math.floor(updatedRaw)
        : typeof frame.t === "number"
          ? frame.t * 1000
          : Date.now();

    if (value === null || value === undefined) {
      lines.push(`${index} null ${updatedMs}`);
      continue;
    }

    switch (typeof value) {
      case "boolean":
        lines.push(`${index} bool ${updatedMs} ${value ? "1" : "0"}`);
        break;
      case "number":
        if (Number.isInteger(value)) {
          lines.push(`${index} int ${updatedMs} ${value}`);
        } else {
          lines.push(`${index} float ${updatedMs} ${value}`);
        }
        break;
      case "string":
        lines.push(`${index} str ${updatedMs} ${sanitizeSlotString(value)}`);
        break;
      case "object":
        lines.push(`${index} str ${updatedMs} ${sanitizeSlotString(JSON.stringify(value))}`);
        break;
      default:
        lines.push(`${index} str ${updatedMs} ${sanitizeSlotString(String(value))}`);
        break;
    }
  }

  return `${lines.join("\n")}\n`;
}

function sanitizeSlotString(value: string): string {
  return value.replaceAll("\n", " ").replaceAll("\r", " ");
}
