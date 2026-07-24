export interface RgbColor {
    r: number;
    g: number;
    b: number;
}
export declare function rgb565(input: string | RgbColor): number;
export declare function parseColor(value: string): RgbColor;
export declare function normaliseColorLiteral(value: string): string;
