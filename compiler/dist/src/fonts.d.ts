export interface FontMetrics {
    id: number;
    name: "3x5" | "5x7" | "8x16" | "seg7";
    glyphWidth: number;
    glyphHeight: number;
    advance: number;
}
export declare const FONT_METRICS: Record<FontMetrics["name"], FontMetrics>;
export declare function fontId(name: string): number;
export declare function measureText(fontName: string, value: string): {
    width: number;
    height: number;
};
export declare function estimateDynamicTextLength(type: string): number;
