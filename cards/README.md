# Card catalogue

This directory keeps the first eight Wall Matrix Panel cards in two formats:

- `*.json` — Stage 0 cards that `compileJson` can ingest directly.
- `*.card` — Stage 1 MXML cards with typed sources, stale metadata, and simple conditionals.

All layouts target a `64x32` matrix and follow the current compiler constraints:

- `3x5` and `5x7` for dense labels and body text
- `8x16` / `seg7` for clock cards
- body text stays at `#e0e0e0` instead of pure white
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
