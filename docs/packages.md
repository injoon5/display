# Packages

npm workspaces monorepo. Root package name: `wall-matrix-panel`.

```
wall-matrix-panel/
├── cards/          # .card catalogue (not an npm package)
├── cad/            # OpenSCAD sources
├── compiler/       # @matrix-panel/compiler
├── convex/         # Convex backend (not a workspace pkg)
├── emulator/       # @matrix-panel/emulator
├── fetcher/        # @wall-matrix-panel/fetcher
├── firmware/       # ESP-IDF project
├── libmxr/         # C99 shared renderer
├── scripts/        # Node orchestrators
└── web/            # SvelteKit dashboard (workspace: web)
```

## Root scripts

| Script | What it does |
|---|---|
| `npm run stack` | Full local stack (Convex + seed + fetcher + web + emulator) |
| `npm run stack:doctor` | Tooling / env sanity check |
| `npm run stack:bootstrap` | Seed + deploy only, then exit |
| `npm run bootstrap` | Seed/deploy against an already-running `convex dev` |
| `npm run emulate` | Device emulator alone |
| `npm run test` | Compiler tests + golden MXR for all cards |
| `npm run golden` | Compile every `cards/*.card` and validate through libmxr |
| `npm run typecheck` | All TS packages + Convex + `web check` |
| `npm run build` | compiler → fetcher → emulator → web |
| `npm run lint` | Typecheck packages (compiler/fetcher/web/convex) |
| `npm run preview:cards` | Batch-render card previews |
| `npm run sync:seed-cards` | Sync catalogue into Convex seed helpers |
| `npm run web:dev` | Dashboard only |
| `npm run convex:codegen` | Regenerate Convex `_generated` |

## Workspace packages

### `@matrix-panel/compiler`

MXML → MXR1 bytecode.

- Stage 0: JSON display lists
- Stage 1: `.card` MXML (lexer, parser, exprs, filters, `<when>` / `<show>` / `<stale>`)
- Stage 2: `row` / `col` / `pad` / `gap` packing (+ `MEASURE`)

```bash
npm run build -w compiler
npm run test -w @matrix-panel/compiler
```

Used by: Convex `programsActions.compileAndDeploy`, dashboard live preview, golden scripts.

### `@wall-matrix-panel/fetcher`

Seoul-shaped source poller. Writes to `api.sources.write` / `writeError`.

Dummy plugins today: bus, subway, KMA now/forecast/nowcast/quake, AirKorea, bike.

```bash
cd fetcher && npm run dev
# or Docker: cd fetcher && docker compose up -d --build
```

### `@matrix-panel/emulator`

Speaks the real device HTTP protocol against `CONVEX_SITE_URL`, renders frames with `libmxr/render_ppm`, serves a preview on `:8787`.

```bash
npm run emulate
```

### `web`

SvelteKit dashboard — cards editor, scenes, rules, sources, firmware, provision.

```bash
npm run web:dev
# optional WASM:
npm run mxr:wasm -w web
```

Routes: `/`, `/cards`, `/cards/[slug]`, `/scenes`, `/rules`, `/sources`, `/firmware`, `/provision`.

## Non-workspace packages

### `convex/`

Schema + queries/mutations/actions/http/crons. Run via:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

Key modules: `devices`, `cards`, `programs` / `programsActions`, `scenes`, `rules`, `sources`, `telemetry`, `firmware`, `http`, `crons`, `lib/seed`.

### `libmxr/`

Plain C99. Zero platform deps.

```bash
make -C libmxr native
make -C libmxr render_ppm
make -C libmxr run-native
```

Firmware links it via `firmware/components/libmxr`. Web can build WASM when `emcc` exists.

### `firmware/`

ESP-IDF v5.x Matrix Portal S3 skeleton. See [`firmware/README.md`](../firmware/README.md).

```bash
cd firmware && idf.py set-target esp32s3 && idf.py build
```

`firmware/host_sim` = offline hardcoded MXR → PPM (does **not** talk to Convex). Live protocol = `emulator/`.

### `cards/`

22 Stage 1 sources. Catalogue table in [`cards/README.md`](../cards/README.md). Golden path: `npm run golden`.

### `cad/`

OpenSCAD parts — pixel grid tiles, bezel, rear shell, cleat, mmWave radome. See [`cad/README.md`](../cad/README.md).

## CI

| Workflow | Job |
|---|---|
| `ci.yml` | typecheck / tests |
| `cards.yml` | compile cards → render / visual path |
| `firmware.yml` | ESP-IDF build → sign → R2 register (when secrets present) |
| `wasm.yml` | emcc build for web preview |

## Dependency rule of thumb

- Dashboard and Convex both depend on `@matrix-panel/compiler` for identical diagnostics.
- Emulator and firmware both depend on `libmxr` sources — never fork the rasteriser.
- Fetcher never talks to the device; it only writes Convex sources.
