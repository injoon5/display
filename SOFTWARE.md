# Software overview

Production-shaped monorepo for the Wall Matrix Panel. Deep docs live in [`docs/`](./docs/README.md).

## Locked stack

| Layer | Choice |
|---|---|
| Device | Adafruit Matrix Portal S3 |
| Renderer | `libmxr` C99 → ESP32 (+ WASM when `emcc` is available) |
| Templating | MXML Stage 0 (JSON) + Stage 1 (`.card`) + Stage 2 packing |
| Backend | Convex (schema, crons, device HTTP) |
| Korean APIs | Oracle ICN fetcher (**dummy data** until keys are configured) |
| Dashboard | SvelteKit + CodeMirror + live preview (TS fallback; WASM optional) |
| HomeKit | HomeSpan (firmware skeleton; disabled by default) |
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
cards/        catalogue Stage 1 `.card` sources (22 cards)
cad/          OpenSCAD parts
scripts/      local stack orchestrator
docs/         getting started, architecture, ops, roadmap, full plan
```

## Fully local stack

```bash
npm ci
npm run stack
```

| Service | URL |
|---|---|
| Dashboard | http://127.0.0.1:5173 |
| Device emulator preview | http://127.0.0.1:8787 |
| Convex API | http://127.0.0.1:3210 |
| Convex HTTP (device) | http://127.0.0.1:3211 |

Demo secrets: device `dev-token-matrix-panel-demo` · dashboard `dashboard-secret`.

More: [`docs/getting-started.md`](./docs/getting-started.md) · [`docs/operations.md`](./docs/operations.md).

## Device HTTP

- `GET /device/wait` — short-poll etag channel
- `GET /device/sync` — program manifest + bytecode URL
- `GET /device/data` — slot frame (JSON / CBOR)
- `POST /device/heartbeat` — telemetry
- `POST /api/pin|scene|poke` — control mirror
- `GET /api/health` — health

Details: [`docs/device-protocol.md`](./docs/device-protocol.md).

## Status

Software path is implemented end-to-end with **dummy API payloads**, and the full path is emulatable locally without hardware.

Known intentional stubs (hardware / API keys / signing keys):

- Real TOPIS / KMA / AirKorea / Spotify / Calendar / GitHub / FX integrations
- HUB75 Protomatter driver (matrix refresh is a no-op without panel hardware)
- HomeSpan enabled build (`CONFIG_MX_HOMESPAN`)
- Production OTA ed25519 (demo accepts unsigned / sha256-demo signatures)

What's left after hardware: [`docs/roadmap.md`](./docs/roadmap.md).
Full design plan: [`docs/plan.md`](./docs/plan.md).
