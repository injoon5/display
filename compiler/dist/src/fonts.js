export const FONT_METRICS = {
    "3x5": { id: 0, name: "3x5", glyphWidth: 3, glyphHeight: 5, advance: 4 },
    "5x7": { id: 1, name: "5x7", glyphWidth: 5, glyphHeight: 7, advance: 6 },
    "8x16": { id: 2, name: "8x16", glyphWidth: 8, glyphHeight: 16, advance: 8 },
    seg7: { id: 3, name: "seg7", glyphWidth: 12, glyphHeight: 20, advance: 12 }
};
export function fontId(name) {
    const metrics = FONT_METRICS[name];
    if (!metrics) {
        throw new Error(`Unknown font: ${name}`);
    }
    return metrics.id;
}
export function measureText(fontName, value) {
    const metrics = FONT_METRICS[fontName];
    if (!metrics) {
        throw new Error(`Unknown font: ${fontName}`);
    }
    if (value.length === 0) {
        return { width: 0, height: metrics.glyphHeight };
    }
    return {
        width: value.length * metrics.advance - Math.max(0, metrics.advance - metrics.glyphWidth),
        height: metrics.glyphHeight
    };
}
export function estimateDynamicTextLength(type) {
    switch (type) {
        case "bool":
            return 5;
        case "color":
            return 7;
        case "float":
            return 8;
        case "int":
            return 6;
        case "string":
            return 10;
        default:
            return 10;
    }
}
//# sourceMappingURL=fonts.js.map