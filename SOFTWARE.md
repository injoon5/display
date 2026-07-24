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
libmxr/       shared C99 bytecode VM + rasteriser (+ render_ppm CLI)
compiler/     @matrix-panel/compiler — MXML → MXR1
convex/       schema, device HTTP, crons, seed
fetcher/      Seoul ICN Node process (dummy plugins)
emulator/     local device that speaks /device/* + C-rendered preview
web/          SvelteKit dashboard
firmware/     ESP-IDF Matrix Portal S3 skeleton (+ offline host_sim)
cards/        first eight catalogue cards
cad/          OpenSCAD parts
scripts/      local stack orchestrator
```

## Fully local stack (recommended)

One process tree brings up Convex, seeds demo data, deploys a compiled card,
starts the Seoul fetcher, the dashboard, and a device emulator that long-polls
the real device HTTP API and paints frames with native `libmxr`:

```bash
npm ci
npm run stack
```

Then open:

| Service | URL |
|---|---|
| Dashboard | http://127.0.0.1:5173 |
| Device emulator preview | http://127.0.0.1:8787 |
| Convex API | http://127.0.0.1:3210 |
| Convex HTTP (device) | http://127.0.0.1:3211 |

Demo secrets:

- Device token: `dev-token-matrix-panel-demo`
- Dashboard secret: `dashboard-secret`

Useful flags:

```bash
npm run stack -- --no-web          # backend + emulator only
npm run stack -- --no-fetcher
npm run stack -- --bootstrap-only  # seed + deploy, then exit
npm run bootstrap                  # seed/deploy against an already-running convex dev
npm run emulate                    # device emulator alone
```

Env templates: `.env.example`, `web/.env.example`, `fetcher/.env.example`, `emulator/.env.example`.

## Manual pieces

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
npm run bootstrap
npm run web:dev
cd fetcher && npm run dev
npm run emulate
make -C libmxr native && make -C libmxr run-native
npm run test
npm run typecheck
```

`firmware/host_sim` is an **offline** unit render (hardcoded MXR → PPM). Live
device protocol emulation is `emulator/` / `npm run stack`.

## Device HTTP

- `GET /device/wait` — long-poll / short-poll etag channel
- `GET /device/sync` — program manifest + bytecode URL
- `GET /device/data` — slot frame
- `POST /device/heartbeat` — telemetry
- `POST /api/pin|scene|poke` — control mirror

## Status

Software path from the plan is implemented end-to-end with **dummy API payloads**,
and the full path is emulatable locally without hardware.

Hardening (post thermo-nuclear review):
- Single deploy path: `programsActions.compileAndDeploy` always server-compiles MXR1
- Device `programStorageId` is the program source of truth
- libmxr string tables match the compiler (length-prefixed); golden tests cover all cards
- Firmware requests JSON slot frames (`Accept: application/json`); non-JSON is an error
- Dashboard client split under `web/src/lib/dashboard/`
- `compiler/dist` is not committed
- Local stack: `npm run stack` (Convex + seed/deploy + fetcher + web + emulator)
