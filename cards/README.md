# Card catalogue

This directory keeps the first eight Wall Matrix Panel cards in two formats:

- `*.json` — Stage 0 cards that `compileJson` can ingest directly.
- `*.card` — Stage 1 MXML cards with typed sources, stale metadata, and simple conditionals.

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
- Stage 1 cards only use absolute `x` / `y` placement

## Current source roots

- `bus` → `seoul.bus`
- `wx` → `kma.now`
- `air` → `airkorea`
- `calendar` → `google.calendar`
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
const files = (await readdir(dir)).filter((name) => name.endsWith(".json") || name.endsWith(".card")).sort();
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
