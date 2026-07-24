import { parseColor, rgb565 } from "./colors.js";
import { measureText } from "./fonts.js";
const CAL_IDLE_A = 0.12;
const CAL_K = 0.0000035;
function colorLuma565(color) {
    const packed = rgb565(color);
    return (((packed >> 11) & 0x1f) * 8) + (((packed >> 5) & 0x3f) * 4) + ((packed & 0x1f) * 8);
}
function estimateNode(node) {
    if (node.kind === "group") {
        return node.children.reduce((sum, child) => sum + estimateNode(child), 0);
    }
    switch (node.kind) {
        case "text": {
            const text = node.template.map((part) => (part.kind === "literal" ? part.value : "0000")).join("");
            const size = measureText(node.font, text);
            const color = node.color.value ?? "#ffffff";
            return size.width * size.height * colorLuma565(color) * 0.2;
        }
        case "icon": {
            const color = node.color?.value ?? "#ffffff";
            return 64 * colorLuma565(color);
        }
        case "bar": {
            const fill = node.color.value ?? "#33cc66";
            const bg = node.bg.value ?? "#202020";
            return (node.w * node.h * colorLuma565(fill) * 0.5) + (node.w * node.h * colorLuma565(bg) * 0.2);
        }
        case "line": {
            const color = node.color.value ?? "#ffffff";
            return 16 * colorLuma565(color);
        }
        default: {
            const color = node.color.value ?? "#ffffff";
            return node.w * node.h * colorLuma565(color);
        }
    }
}
export function estimateAmps(layout) {
    try {
        const load = layout.nodes.reduce((sum, node) => sum + estimateNode(node), 0);
        return Number((CAL_IDLE_A + load * CAL_K).toFixed(3));
    }
    catch {
        return CAL_IDLE_A;
    }
}
export function isValidLiteralColor(value) {
    try {
        parseColor(value);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=power.js.map