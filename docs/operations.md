# Operations — build & run this thing

Day-0 through day-2: local stack, checks, cards, firmware, deploy, and how to keep it alive.

## 0. Install

```bash
npm ci
npm run stack:doctor
```

Need: Node 22+, npm, CMake/make/C99. Optional: `emcc`, ESP-IDF v5, OpenSCAD.

## 1. Local development (preferred)

```bash
npm run stack
```

| Port | Service |
|---:|---|
| 5173 | SvelteKit dashboard |
| 8787 | Device emulator preview |
| 3210 | Convex client API |
| 3211 | Convex HTTP (device + `/api/*`) |

Stop with Ctrl+C — the orchestrator tears down child processes.

Useful variants:

```bash
npm run stack -- --no-web
npm run stack -- --bootstrap-only
npm run bootstrap          # Convex already running
npm run emulate            # emulator only
```

### What "healthy" looks like

- Dashboard loads and lists cards
- Emulator `/readyz` returns `{ "ready": true }`
- Emulator preview shows a changing clock / rotating playlist
- Fetcher logs periodic `sources:write` for bus/wx/air/…

## 2. Quality gates (run before you push)

```bash
npm run typecheck
npm run test              # compiler + golden MXR
npm run lint
npm run build
```

Golden path specifically:

```bash
npm run golden            # every cards/*.card compiles + libmxr-validates
npm run preview:cards     # batch visual previews
```

## 3. Cards workflow

1. Edit `cards/<slug>.card` (or use dashboard `/cards/[slug]`)
2. `npm run golden` — must stay green
3. Deploy via dashboard or Convex `programsActions.compileAndDeploy`
4. Emulator / device picks up new `programEtag` on the next `/device/wait`

Sync seed helpers after catalogue changes:

```bash
npm run sync:seed-cards
```

Source roots and compile snippets: [`cards/README.md`](../cards/README.md) · [MXML guide](./mxml.md).

## 4. Convex

### Local / agent

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

Anonymous mode = isolated deployment. Safe for cloud agents and for not clobbering your personal project.

### Cloud (your account)

```bash
npx convex dev            # link + develop against your project
npx convex deploy         # production only
```

Codegen:

```bash
npm run convex:codegen
```

Schema lives in [`convex/schema.ts`](../convex/schema.ts). Device HTTP in [`convex/http.ts`](../convex/http.ts). Crons in [`convex/crons.ts`](../convex/crons.ts).

## 5. Seoul fetcher

Dummy plugins by default — realistic Seoul-shaped payloads, no API keys.

```bash
cd fetcher
cp .env.example .env
npm run dev
```

Docker (Oracle ICN shape):

```bash
cd fetcher
cp .env.example .env
docker compose up -d --build
# optional Tailscale + uptime-kuma:
docker compose --profile ops up -d
```

When you're ready for real APIs: register keys ([plan appendix B](./plan.md#b-korean-api-registration)), replace dummy plugin bodies, request raised quotas (20s bus poll ≈ 4.3k/day).

## 6. libmxr

```bash
make -C libmxr native
make -C libmxr render_ppm
make -C libmxr run-native
```

WASM for the dashboard (optional):

```bash
npm run mxr:wasm -w web
```

**Never** hand-edit generated WASM glue to "fix" a preview mismatch — rebuild from C.

## 7. Firmware (Matrix Portal S3)

Details: [`firmware/README.md`](../firmware/README.md).

```bash
cd firmware
idf.py set-target esp32s3
idf.py build
idf.py -p /dev/ttyACM0 flash monitor
```

Release / OTA packaging:

```bash
./scripts/release.sh stable
# set R2_URL for published artifact; OTA_SIGNATURE for real ed25519
```

Notes that will save you hours:

- HomeSpan is behind `CONFIG_MX_HOMESPAN` (off by default)
- `CONFIG_MX_OTA_ALLOW_UNSIGNED=1` for demo; turn off for prod + bake pubkey
- NVS must survive OTA (HomeKit pairing, Wi-Fi, token) — `partitions.csv` already preserves it
- HUB75 refresh is currently a **documented stub** until Protomatter/ESP-IDF driver is wired
- Sensors return synthetic stubs until drivers are attached

Offline host sim (no network):

```bash
cmake -S firmware/host_sim -B firmware/host_sim/build
cmake --build firmware/host_sim/build
./firmware/host_sim/build/mx_host_sim
```

## 8. CAD / enclosure

```bash
openscad cad/pixel_grid_tile.scad
openscad -o out/pixel_grid_tile.stl cad/pixel_grid_tile.scad
```

Print **pixel grid tiles first**, evaluate alone against the bare panel, then commit to bezel/shell. Full optical stack: [plan §5](./plan.md#5-enclosure--3d-printing).

## 9. Production deploy shape

| Layer | Command / action | Host |
|---|---|---|
| Backend | `npx convex deploy` | Convex Cloud |
| Dashboard | `cd web && npm run build && wrangler pages deploy` | Cloudflare Pages |
| Fetcher | `git pull && docker compose up -d --build` on Oracle ICN | Always Free A1 |
| Firmware | `idf.py build && ./scripts/release.sh stable` | R2 + Convex firmware table |
| Blobs | R2 | zero egress |

Cost target from the plan: **$0/mo** on free tiers. See [plan §18](./plan.md#18-hosting-deploy--cost).

## 10. Day-2 ops checklist

- [ ] Device heartbeat fresh (`online`, `lastSeen`) — Convex cron marks offline after ~90s silence
- [ ] Circuit breakers on sources (`consecutiveFailures` / `circuitOpenUntil`)
- [ ] Fetcher uptime (Uptime Kuma on the Oracle box)
- [ ] OTA only on `stable` after a soak on `dev`
- [ ] After OTA: confirm HomeKit still paired (NVS survived)
- [ ] Power governor calibrated with a USB meter on the real panel
- [ ] Snapshot / golden still green in CI

## 11. Debugging map

| Symptom | Look here |
|---|---|
| Emulator never ready | `CONVEX_SITE_URL`, device token vs seed, `libmxr/render_ppm` built |
| Dashboard blank / no data | `PUBLIC_CONVEX_URL`, Convex up on `:3210` |
| Card won't deploy | Compiler diagnostics; run `npm run golden` |
| Preview ≠ device | Rebuild `libmxr` WASM; font tables diverged |
| Fetcher silent | `.env` `CONVEX_URL`; check Convex logs for `sources.write` |
| Firmware won't pair HomeKit after OTA | `partitions.csv` / NVS erase |
| Panel tears under HAP traffic | HomeSpan pinned to core 1 (plan §8.1) |

## 12. Demo secrets (local only)

| Secret | Value |
|---|---|
| Device token | `dev-token-matrix-panel-demo` |
| Dashboard secret | `dashboard-secret` |

Do not reuse these in production. Seed logic: [`convex/lib/seed.ts`](../convex/lib/seed.ts).
