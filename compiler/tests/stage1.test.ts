import { describe, expect, it } from "vitest";

import { compileMxml } from "../src/index.js";

describe("Stage 1 MXML compiler", () => {
  it("compiles a bus card with conditional colour", () => {
    const result = compileMxml(`
      <card id="bus-402" name="Bus 402" priority="80">
        <source id="bus" kind="seoul.bus" arsId="23-005" route="402" every="20s" />
        <text x="20" y="2" font="5x7" color="{{ bus.eta_min <= 3 ? '#ff4444' : '#ffffff' }}">
          {{ bus.eta_min }}분
        </text>
        <when test="{{ bus.eta_min <= 1 }}">
          <blink rate="600ms"><stroke color="#ff0000" /></blink>
        </when>
        <show when="{{ weekday and now.hour >= 7 and now.hour < 10 }}" />
        <stale after="90s" style="dim" />
      </card>
    `);

    expect(result.diagnostics.filter((entry) => entry.severity === "error")).toHaveLength(0);
    expect(result.sources).toEqual(["bus"]);
    expect(result.slotMap.some((entry) => entry.path.includes("bus.eta_min"))).toBe(true);
  });

  it("reports an unguarded nullable error", () => {
    const result = compileMxml(`
      <card id="bus-402" name="Bus 402" priority="80">
        <source id="bus" kind="seoul.bus" arsId="23-005" route="402" every="20s" />
        <text x="0" y="0" font="5x7" color="#ffffff">{{ bus.next_eta_min }}</text>
      </card>
    `);

    expect(result.diagnostics.some((entry) => entry.code.includes("nullable"))).toBe(true);
  });

  it("reports overflow errors", () => {
    const result = compileMxml(`
      <card id="overflow" name="Overflow" priority="1">
        <text x="60" y="28" font="5x7" color="#ffffff">TOO WIDE</text>
      </card>
    `);

    expect(result.diagnostics.some((entry) => entry.code === "layout.overflow")).toBe(true);
  });

  it("warns when colours collapse to the same RGB565 value", () => {
    const result = compileMxml(`
      <card id="color-collapse" name="Color Collapse" priority="1">
        <frect x="0" y="0" w="10" h="10" color="#ffffff" />
        <frect x="12" y="0" w="10" h="10" color="#fefefe" />
      </card>
    `);

    expect(result.diagnostics.some((entry) => entry.code === "color.rgb565-collapse")).toBe(true);
  });
});
