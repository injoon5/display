# Card catalogue

Stage 1 MXML sources for the Wall Matrix Panel catalogue (`*.card`).

There are currently **22** cards in this directory (more than the original
“first eight” set). Stage 0 `*.json` cards are supported by the compiler
(`compileJson`) but are not checked in here — local fixtures and seed use
the Stage 1 `.card` sources directly.

All layouts target a `64x32` matrix and follow the current compiler constraints:

- `5x7` is the smallest font used, for labels and body text — it stays legible
  where the `3x5` font turns ambiguous (`PM2.5`, `NEXT`, `ROOM`, `RSSI`)
- `8x16` for the hero value on a card (temperature, PM2.5, clock). It is a clean
  integer 2x scale of the `5x7` glyphs, so every stroke is a constant 2px
- one label row, one hero row, one detail row — with a couple of pixels of
  breathing room between them
- accent colours are varied per card (blue / green / amber / purple) rather than
  leaning on a single hue
- hero/value text is `#f0f0f0`; secondary labels use the muted `#8f9f8d`
- Absolute `x` / `y` placement is the default; Stage 2 `<row>` / `<col>` /
  `<box>` / `<spacer>` packing is also supported

## Current source roots

- `bus` → `seoul.bus` (includes `eta2_min` / `eta3_min` for multi-route cards)
- `wx` → `kma.now`
- `air` → `airkorea`
- `calendar` → `google.calendar`
- `spotify` → ambient `np.*` (title/artist/playing/ago)
- `github` → ambient `gh.*` (total/streak)
- `fx` → ambient `krw.*` (rate/change_pct)
- `todo` / `dday` → ambient roots of the same name
- `moon` / `year` → synthesized in runtime scope from wall-clock time
- `device` → `panel.device`
- `telemetry` → `panel.telemetry`
- ambient → `now.*`, `room.*`

## Local compile check

From the repo root:

```bash
npm run build -w compiler
node --input-type=module <<'EOF'
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "./compiler/dist/src/index.js";

const dir = path.join(process.cwd(), "cards");
const files = (await readdir(dir)).filter((name) => name.endsWith(".card") || name.endsWith(".json")).sort();
for (const file of files) {
  const source = await readFile(path.join(dir, file), "utf8");
  const input = file.endsWith(".json") ? JSON.parse(source) : source;
  const result = compile(input);
  const errors = result.diagnostics.filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    console.error(file, errors);
    process.exitCode = 1;
  } else {
    console.log(`ok ${file}`);
  }
}
EOF
```
