import { describe, expect, it } from "vitest";
import { resolveSlotValue } from "../src/slots.js";

describe("resolveSlotValue", () => {
  const scope = {
    bus: { eta_min: 3, next_eta_min: null as number | null },
    now: { hhmm: "22:15" },
  };

  it("resolves plain paths", () => {
    expect(resolveSlotValue(scope, "now.hhmm")).toBe("22:15");
    expect(resolveSlotValue(scope, "bus.eta_min")).toBe(3);
  });

  it("evaluates filter expressions used as slot paths", () => {
    expect(resolveSlotValue(scope, 'now.hhmm | default("00:00")')).toBe("22:15");
    expect(resolveSlotValue(scope, 'bus.next_eta_min | default("--")')).toBe("--");
  });

  it("renders template: slot paths", () => {
    expect(resolveSlotValue(scope, "template:{{bus.eta_min}}'")).toBe("3'");
    expect(resolveSlotValue(scope, 'template:{{bus.next_eta_min | default("--")}}\'')).toBe("--'");
  });
});
