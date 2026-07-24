import { describe, expect, it } from "vitest";
import { evaluateExpression, parseExpression } from "../src/index.js";
describe("expression parser and evaluator", () => {
    it("evaluates ternaries and arithmetic", () => {
        const expr = parseExpression("bus.eta_min <= 3 ? 1 : 0");
        expect(evaluateExpression(expr, { bus: { eta_min: 2 } })).toBe(1);
        expect(evaluateExpression(expr, { bus: { eta_min: 5 } })).toBe(0);
    });
    it("supports filters", () => {
        const expr = parseExpression("value | clamp(0, 10) | fixed(1)");
        expect(evaluateExpression(expr, { value: 12.34 })).toBe("10.0");
    });
});
//# sourceMappingURL=expr.test.js.map