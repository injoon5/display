import { describe, expect, it } from "vitest";

import { compileMxml } from "../src/index.js";

describe("Stage 2 layout containers", () => {
  it("packs row children left-to-right with gap and spacer", () => {
    const result = compileMxml(`
      <card id="row-pack" name="Row Pack" priority="1">
        <row x="2" y="4" gap="2">
          <frect w="10" h="5" color="#ffffff" />
          <frect w="8" h="5" color="#ff0000" />
          <spacer w="3" />
          <pixel color="#00ff00" />
        </row>
      </card>
    `);

    // 2 → +10+2 → 14 → +8+2 → 24 → spacer 3+2 → 29
    expect(result.diagnostics.filter((entry) => entry.severity === "error")).toHaveLength(0);
    expect(result.diagnostics.some((entry) => entry.code === "layout.unsupported-container")).toBe(false);
    expect(result.bytecode.byteLength).toBeGreaterThan(0);
  });

  it("packs col children top-to-bottom", () => {
    const result = compileMxml(`
      <card id="col-pack" name="Col Pack" priority="1">
        <col x="1" y="2" gap="1">
          <text font="5x7" color="#ffffff">A</text>
          <text font="5x7" color="#ffffff">B</text>
        </col>
      </card>
    `);

    expect(result.diagnostics.filter((entry) => entry.severity === "error")).toHaveLength(0);
  });

  it("offsets box children by box origin", () => {
    const result = compileMxml(`
      <card id="box-pack" name="Box Pack" priority="1">
        <box x="10" y="5">
          <pixel x="2" y="3" color="#ffffff" />
        </box>
      </card>
    `);

    expect(result.diagnostics.filter((entry) => entry.severity === "error")).toHaveLength(0);
  });

  it("ignores top-level spacer", () => {
    const result = compileMxml(`
      <card id="spacer-top" name="Spacer" priority="1">
        <spacer w="4" h="4" />
        <pixel x="0" y="0" color="#ffffff" />
      </card>
    `);

    expect(result.diagnostics.filter((entry) => entry.severity === "error")).toHaveLength(0);
  });

  it("nests col inside row without child x/y", () => {
    const result = compileMxml(`
      <card id="nested" name="Nested" priority="1">
        <row x="0" y="0" gap="2">
          <badge bg="#1a5fb4" fg="#ffffff" font="3x5">402</badge>
          <col gap="1">
            <text font="5x7" color="#ffffff">12</text>
            <text font="3x5" color="#666666">34</text>
          </col>
          <bar w="4" h="24" value="2" max="3" color="#33cc66" />
        </row>
      </card>
    `);

    expect(result.diagnostics.filter((entry) => entry.severity === "error")).toHaveLength(0);
  });
});
