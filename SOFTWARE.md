# Wall Matrix Panel — Software

Production-shaped monorepo implementing the plan in `README.md`.

## Locked stack

| Layer | Choice |
|---|---|
| Device | Adafruit Matrix Portal S3 |
| Renderer | `libmxr` C99 → ESP32 + WASM |
| Templating | MXML Stage 0 (JSON) + Stage 1 (`.card`) |
| Backend | Convex (schema, crons, device HTTP) |
| Korean APIs | Oracle ICN fetcher (dummy data for now) |
| Dashboard | SvelteKit + CodeMirror + live preview |
| HomeKit | HomeSpan (firmware skeleton) |
| Transport | HTTPS long-poll — **no MQTT** |

## Layout

```
libmxr/       shared C99 bytecode VM + rasteriser
compiler/     @matrix-panel/compiler — MXML → MXR1
convex/       schema, device HTTP, crons, seed
fetcher/      Seoul ICN Node process (dummy plugins)
web/          SvelteKit dashboard
firmware/     ESP-IDF Matrix Portal S3 skeleton
cards/        first eight catalogue cards
cad/          OpenSCAD parts
```

## Quick start

```bash
npm ci
npm run test                 # compiler vitest
npm run typecheck
npm run web:dev              # dashboard (mock data if no Convex URL)
CONVEX_AGENT_MODE=anonymous npx convex dev
cd fetcher && npm run start  # dummy Korean sources → Convex
make -C libmxr native && make -C libmxr run-native
```

Device token for seed: `dev-token-matrix-panel-demo`  
Dashboard secret: `dashboard-secret`

## Device HTTP

- `GET /device/wait` — long-poll / short-poll etag channel
- `GET /device/sync` — program manifest + bytecode URL
- `GET /device/data` — slot frame
- `POST /device/heartbeat` — telemetry
- `POST /api/pin|scene|poke` — control mirror

## Status

Software path from the plan is implemented end-to-end with **dummy API payloads**.

Hardening (post thermo-nuclear review):
- Single deploy path: `programsActions.compileAndDeploy` always server-compiles MXR1
- Device `programStorageId` is the program source of truth
- libmxr string tables match the compiler (length-prefixed); golden tests cover all cards
- Firmware requests JSON slot frames (`Accept: application/json`); non-JSON is an error
- Dashboard client split under `web/src/lib/dashboard/`
- `compiler/dist` is not committed

Firmware builds require ESP-IDF on a real host; `firmware/host_sim` + `libmxr` native/golden tests run without hardware.
