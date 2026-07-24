import { describe, expect, it } from "vitest";
import { compileJson } from "../src/index.js";
describe("Stage 0 JSON compiler", () => {
    it("compiles the bus card example", () => {
        const result = compileJson({
            elements: [
                { bind: "bus.eta_min", color: "#ffffff", font: "5x7", op: "text", x: 20, y: 2 },
                { color: "#ffffff", font: "5x7", op: "text", value: "분", x: 44, y: 2 }
            ],
            id: "bus"
        });
        expect(result.diagnostics.filter((entry) => entry.severity === "error")).toHaveLength(0);
        expect(new TextDecoder().decode(result.bytecode.slice(0, 4))).toBe("MXR1");
        expect(result.slotMap).toEqual(expect.arrayContaining([
            expect.objectContaining({
                path: "bus.eta_min",
                sourceId: "bus"
            })
        ]));
        expect(result.sources).toContain("bus");
    });
});
//# sourceMappingURL=stage0.test.js.map