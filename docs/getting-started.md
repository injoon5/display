# Getting started

Goal: from a cold clone to a live dashboard + C-rendered device emulator, no hardware, no cloud account.

## Prerequisites

| Tool | Required? | Notes |
|---|---|---|
| Node.js **22+** | yes | Workspaces + modern TS |
| npm | yes | Comes with Node |
| CMake + make + a C99 compiler | yes | `libmxr` / `render_ppm` used by the emulator |
| Emscripten (`emcc`) | optional | WASM preview in the dashboard (TS fallback works without it) |
| ESP-IDF v5.x | optional | Only for flashing a Matrix Portal S3 |
| OpenSCAD | optional | CAD parts in `cad/` |

Check the machine:

```bash
npm run stack:doctor
```

## 60-second path

```bash
git clone https://github.com/injoon5/display.git
cd display
npm ci
npm run stack
```

That single command:

1. Starts **local Convex** in `CONVEX_AGENT_MODE=anonymous` (isolated; won't touch your personal Convex)
2. Seeds demo data and compiles/deploys a card playlist
3. Starts the **Seoul fetcher** (dummy Korean API payloads)
4. Starts the **SvelteKit dashboard** on `:5173`
5. Starts the **device emulator** on `:8787` — real `/device/*` long-poll loop + native `libmxr` frames

Open:

| What | Where |
|---|---|
| Dashboard | http://127.0.0.1:5173 |
| Emulator preview | http://127.0.0.1:8787 |

Demo auth (seeded automatically):

- Device token: `dev-token-matrix-panel-demo`
- Dashboard secret: `dashboard-secret`

## Stack flags

```bash
npm run stack -- --no-web          # backend + emulator only
npm run stack -- --no-fetcher      # skip Seoul fetcher
npm run stack -- --no-emulator     # skip device emulator
npm run stack -- --bootstrap-only  # seed + deploy, then exit
npm run stack -- --skip-bootstrap  # assume already seeded
npm run stack -- --doctor          # env/tooling check only
```

## Env files

Templates exist; `npm run stack` writes `.env.local` if missing.

| File | Purpose |
|---|---|
| `.env.example` → `.env.local` | Root Convex URLs + agent mode |
| `web/.env.example` | `PUBLIC_CONVEX_URL` for the dashboard |
| `fetcher/.env.example` | Fetcher → Convex |
| `emulator/.env.example` | Device token + site URL |

Local defaults:

```bash
CONVEX_AGENT_MODE=anonymous
CONVEX_URL=http://127.0.0.1:3210        # client / WebSocket
CONVEX_SITE_URL=http://127.0.0.1:3211   # HTTP actions (/device/*, /api/*)
```

## Manual pieces (if you don't want the orchestrator)

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev   # terminal 1
npm run bootstrap                            # seed + deploy once Convex is up
npm run web:dev                              # dashboard
cd fetcher && npm run dev                    # Seoul fetcher
npm run emulate                              # device emulator
```

Offline-only raster smoke (no Convex):

```bash
make -C libmxr native && make -C libmxr run-native
# or
cmake -S firmware/host_sim -B firmware/host_sim/build
cmake --build firmware/host_sim/build
./firmware/host_sim/build/mx_host_sim
```

## Verify it works

```bash
npm run typecheck
npm run test          # compiler unit tests + golden MXR for all 22 cards
npm run golden        # compile every cards/*.card through libmxr
```

In the dashboard: open **Cards**, edit `clock.card`, watch the live preview update. Hit deploy (when wired to live Convex) and the emulator's program etag flips.

## Next

- [Architecture](./architecture.md) — why this shape
- [MXML](./mxml.md) — write your first card
- [Operations](./operations.md) — day-2, deploy, firmware
- [Roadmap](./roadmap.md) — what's left after hardware
