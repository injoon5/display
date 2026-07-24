# Contributing

## Prerequisites

- Node.js **22+** and npm
- CMake / make / a C99 compiler (`libmxr`, emulator `render_ppm`, `firmware/host_sim`)
- Optional: Emscripten (`emcc`) for dashboard WASM preview
- Optional: ESP-IDF v5.x for Matrix Portal S3 firmware
- Optional: OpenSCAD for `cad/`

```bash
npm ci
npm run stack:doctor
```

## Fully local stack (preferred)

No hardware. No personal Convex account. Cloud-agent safe.

```bash
npm run stack
```

Starts:

1. Local Convex (`CONVEX_AGENT_MODE=anonymous`)
2. Demo seed + `compileAndDeploy`
3. Seoul fetcher (dummy plugins → `sources:write`)
4. SvelteKit dashboard on `:5173`
5. Device emulator on `:8787` (real `/device/*` + `libmxr` frames)

| Service | URL |
|---|---|
| Dashboard | http://127.0.0.1:5173 |
| Emulator preview | http://127.0.0.1:8787 |
| Convex API | http://127.0.0.1:3210 |
| Convex HTTP | http://127.0.0.1:3211 |

Demo secrets: device `dev-token-matrix-panel-demo` · dashboard `dashboard-secret`.

Flags: `--no-web`, `--no-fetcher`, `--no-emulator`, `--bootstrap-only`, `--skip-bootstrap`, `--doctor`.

## Common commands

```bash
npm run typecheck
npm run build
npm run test                 # compiler unit tests + golden MXR
npm run golden               # all cards/*.card through libmxr
npm run bootstrap            # seed + deploy (Convex already up)
npm run emulate              # device emulator only
npm run web:dev
```

## Cards

Edit `cards/*.card` or use the dashboard editor.

```bash
npm run build -w compiler
npm run golden
```

Language guide: [`docs/mxml.md`](./docs/mxml.md). Catalogue: [`cards/README.md`](./cards/README.md).

## Offline firmware host simulator

Hardcoded MXR → PPM (**does not** talk to Convex):

```bash
cmake -S firmware/host_sim -B firmware/host_sim/build
cmake --build firmware/host_sim/build
./firmware/host_sim/build/mx_host_sim
```

Live device protocol loop: `npm run emulate` / `npm run stack`.

## Optional WASM build

```bash
npm run mxr:wasm -w web
```

## Docs map

- [`docs/getting-started.md`](./docs/getting-started.md)
- [`docs/operations.md`](./docs/operations.md)
- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/roadmap.md`](./docs/roadmap.md)
- [`AGENTS.md`](./AGENTS.md) — for coding agents
- [`docs/plan.md`](./docs/plan.md) — full hardware/design plan

## Patch rules

- Keep `npm run golden` green if you touch cards/compiler/libmxr.
- Don't commit `compiler/dist`.
- Don't "fix" intentional firmware/API stubs by removing them — see roadmap.
- Prefer small PRs with a clear ops story ("how do I run this?").
