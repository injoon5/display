# Cards

Stage 1 MXML sources currently in the repo (`*.card`) — **22 cards**.

| Slug | Name |
|---|---|
| `air` | Air Quality |
| `bus-402` | Bus |
| `calendar-next` | Calendar Next |
| `clock` | Clock |
| `clock-dim` | Clock Dim |
| `dday` | D-Day |
| `fireplace` | Fireplace |
| `github` | GitHub |
| `iconsheet` | Weather Icons |
| `indoor` | Indoor |
| `krw` | KRW/USD |
| `life` | Life |
| `matrix` | Matrix |
| `moon` | Moon |
| `now-playing` | Now Playing |
| `rain-fx` | Rain |
| `self-status` | Self Status |
| `starfield` | Warp |
| `todo` | Todo |
| `upcoming-weather` | Forecast |
| `weather` | Weather |
| `year-progress` | Year |

Layouts target `64×32`. Absolute `x`/`y` is the default; Stage 2 `<row>` / `<col>` /
`<box>` / `<spacer>` packing is also supported.

## Source roots

- `bus` → `seoul.bus` (includes `eta2_min` / `eta3_min`)
- `wx` → `kma.now`
- `air` → `airkorea`
- `calendar` → `google.calendar`
- `spotify` → ambient `np.*`
- `github` → ambient `gh.*`
- `fx` → ambient `krw.*`
- `todo` / `dday` → same-named ambient roots
- `moon` / `year` → synthesized from wall-clock time
- `device` / `telemetry` / `now` / `room` → panel ambient

## Compile check

```bash
npm run build -w compiler
node --input-type=module <<'EOF'
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "./compiler/dist/src/index.js";

const dir = path.join(process.cwd(), "cards");
const files = (await readdir(dir)).filter((name) => name.endsWith(".card")).sort();
for (const file of files) {
  const source = await readFile(path.join(dir, file), "utf8");
  const result = compile(source);
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

Or: `npm run golden`.
