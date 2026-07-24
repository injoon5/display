# MXML — card language

Cards are tiny declarative UIs for a **64×32** RGB matrix. You write MXML (or Stage 0 JSON); the compiler emits **MXR1 bytecode**; the device only runs the VM.

Invalid cards die in the editor. The panel never parses templates.

## Quick example

```xml
<card id="clock" name="Clock" priority="64">
  <text x="3" y="9" font="8x16" color="#f0f0f0">{{ now.hhmm | default('00:00') }}</text>
  <stale after="2m" style="dim" />
</card>
```

Live sources in [`cards/`](../cards/) — **22 cards**. See [`cards/README.md`](../cards/README.md).

## Stages

| Stage | Input | Layout | Status in repo |
|---|---|---|---|
| **0** | JSON display list | Absolute coords | Supported (compiler accepts JSON objects) |
| **1** | `.card` MXML | Absolute `x`/`y` | **Shipped** — all catalogue cards |
| **2** | Same MXML | `row` / `col` / `pad` / `gap` / `spacer` | Supported in compiler; optional for new cards |

Build Stage 0 first if you're extending the language. Stage 1 is what you edit day-to-day. Stage 2 packing is there when hand-placing coords gets annoying.

## Elements (cheat sheet)

| Element | Role |
|---|---|
| `<card>` | Root — `id`, `name`, `priority`, optional dwell |
| `<text>` | String / template at `x`,`y` with `font` + `color` |
| `<digits>` | Numeric; prefer `tabular` for clocks/ETAs |
| `<rect>` / `<line>` / `<pixel>` | Primitives |
| `<icon>` | Atlas glyph |
| `<when>` / `<show>` | Conditional include |
| `<stale>` | Dim/grey when data older than `after` |
| `<fx>` | Built-in effects (matrix rain, fireplace, life, …) |
| `<row>` / `<col>` / `<box>` / `<spacer>` | Stage 2 packing |

Full element/attribute/expression reference: [plan §10](./plan.md#10-mxml--the-card-templating-engine).

## Expressions & filters

```
{{ bus.eta_min }}
{{ bus.eta_min | default('--') }}
{{ air.pm25 > 75 ? '#ff4444' : '#88ff88' }}
```

Same expression grammar is reused for **scenes/rules** conditions. Types come from source Zod schemas / compiler source defs — not invented in MXML.

## Data binding → slots

Compiler walks `{{ path }}` references, assigns **slot indices**, and emits a slot map. At runtime the device receives a compact slot frame (CBOR or JSON) and patches values — **no recompile** when the bus ETA changes.

Source roots used by the catalogue:

| Root | Source |
|---|---|
| `bus` | `seoul.bus` |
| `wx` | `kma.now` |
| `air` | `airkorea` |
| `calendar` | `google.calendar` |
| `np` / `gh` / `krw` / `todo` / `dday` | ambient / synthesized |
| `moon` / `year` | wall-clock synthesis |
| `now` / `room` / `device` / `telemetry` | panel ambient |

## Compile locally

```bash
npm run build -w compiler
npm run golden          # all 22 cards → MXR1 → libmxr validate
```

One-off:

```bash
node --input-type=module <<'EOF'
import { readFile } from "node:fs/promises";
import { compile } from "./compiler/dist/src/index.js";
const source = await readFile("cards/bus-402.card", "utf8");
const result = compile(source);
console.log(result.diagnostics, result.bytecode?.byteLength);
EOF
```

## Editor loop (dashboard)

1. Open `/cards/[slug]`
2. Edit source — live preview via WASM `libmxr` (or TS fallback)
3. Diagnostics show as red squiggles (overflow, unknown field, power budget)
4. Deploy → Convex `programsActions.compileAndDeploy` **server-compiles** again (client bytecode is never trusted as the deploy artifact)

## Power budget

Compiler estimates amps from lit pixels. Cards that would brown out the PSU fail compile. Calibrate the governor on real hardware — see [plan §7.3](./plan.md#73-the-power-governor--write-this-on-day-one).

## Deliberately excluded

No scripting on-device. No loops that allocate. No network from cards. No fonts beyond the subset. No "just run JS". If you need new capability, extend the compiler + `libmxr` opcodes — keep the VM boring.

Bytecode / opcode reference: [plan §11](./plan.md#11-bytecode-specification).
