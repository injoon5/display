import { normaliseColorLiteral, parseColor } from "./colors.js";
function formatDate(value) {
    const date = new Date(value * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function formatTime(value, withSeconds) {
    const date = new Date(value * 1000);
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mm = String(date.getUTCMinutes()).padStart(2, "0");
    if (!withSeconds) {
        return `${hh}:${mm}`;
    }
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}
function interpolateChannel(a, b, t) {
    return Math.round(a + (b - a) * t);
}
function colorScale(value, a, b, c) {
    const clamped = Math.max(0, Math.min(1, value));
    const left = parseColor(a);
    const middle = parseColor(b);
    if (!c) {
        return normaliseColorLiteral(`#${interpolateChannel(left.r, middle.r, clamped).toString(16).padStart(2, "0")}${interpolateChannel(left.g, middle.g, clamped).toString(16).padStart(2, "0")}${interpolateChannel(left.b, middle.b, clamped).toString(16).padStart(2, "0")}`);
    }
    const right = parseColor(c);
    const segment = clamped < 0.5 ? clamped * 2 : (clamped - 0.5) * 2;
    const start = clamped < 0.5 ? left : middle;
    const end = clamped < 0.5 ? middle : right;
    return normaliseColorLiteral(`#${interpolateChannel(start.r, end.r, segment).toString(16).padStart(2, "0")}${interpolateChannel(start.g, end.g, segment).toString(16).padStart(2, "0")}${interpolateChannel(start.b, end.b, segment).toString(16).padStart(2, "0")}`);
}
export function applyFilter(name, input, args) {
    switch (name) {
        case "round":
            return Math.round(Number(input));
        case "floor":
            return Math.floor(Number(input));
        case "ceil":
            return Math.ceil(Number(input));
        case "abs":
            return Math.abs(Number(input));
        case "pad":
            return String(Math.trunc(Number(input))).padStart(Number(args[0] ?? 2), "0");
        case "comma":
            return Number(input).toLocaleString("en-US");
        case "fixed":
            return Number(input).toFixed(Number(args[0] ?? 0));
        case "upper":
            return String(input ?? "").toUpperCase();
        case "lower":
            return String(input ?? "").toLowerCase();
        case "trunc": {
            const max = Number(args[0] ?? 8);
            const text = String(input ?? "");
            return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
        }
        case "default":
            return input ?? args[0] ?? "";
        case "relative":
            return `${Math.abs(Math.round(Number(input)))}s`;
        case "duration": {
            const total = Math.abs(Math.round(Number(input)));
            const hours = Math.floor(total / 3600);
            const minutes = Math.floor((total % 3600) / 60);
            const seconds = total % 60;
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            }
            if (minutes > 0) {
                return `${minutes}m ${seconds}s`;
            }
            return `${seconds}s`;
        }
        case "hhmm":
            return formatTime(Number(input), false);
        case "hhmmss":
            return formatTime(Number(input), true);
        case "date":
            return formatDate(Number(input));
        case "color_scale":
            return colorScale(Number(input), String(args[0] ?? "#000000"), String(args[1] ?? "#ffffff"), args[2] ? String(args[2]) : undefined);
        case "map": {
            const [a, b, c, d] = args.map(Number);
            const ratio = (Number(input) - a) / (b - a);
            return c + ratio * (d - c);
        }
        case "clamp": {
            const lo = Number(args[0] ?? 0);
            const hi = Number(args[1] ?? 1);
            return Math.max(lo, Math.min(hi, Number(input)));
        }
        case "icon_for":
            return `icon:${String(input ?? "unknown")}`;
        default:
            throw new Error(`Unknown filter: ${name}`);
    }
}
//# sourceMappingURL=filters.js.map