# AGENTS.md

Instructions for coding agents (Cursor, Codex, Jules, CI bots) working in this repo.

## What this is

Wall Matrix Panel — 64×32 LED display monorepo. Device runs **MXR1 bytecode** from a shared C99 renderer (`libmxr`). Cards are MXML. Backend is Convex. Local DX is `npm run stack`.

Read [`docs/README.md`](./docs/README.md) before large changes. Status of stubs: [`docs/roadmap.md`](./docs/roadmap.md).

## Non-negotiables

1. **Do not break preview == device.** `libmxr` is the single rasteriser. Prefer fixing C sources over papering over WASM/TS fallback drift.
2. **Do not put template parsing or JSON schema logic in firmware.** Intelligence stays in the compiler + Convex.
3. **Server-compile on deploy.** `programsActions.compileAndDeploy` must remain the trusted path; never trust client-supplied bytecode as the stored artifact.
4. **No MQTT.** Device sync is HTTPS long-poll via Convex HTTP actions.
5. **Convex agent mode for cloud agents:** `CONVEX_AGENT_MODE=anonymous` — never point agents at a human's personal Convex deployment.
6. **Await all Convex DB/scheduler promises.** Public functions need `args` + `returns` validators and auth where they touch user/device data.
7. **Prefer indexes over `.filter()`** in Convex queries. No `Date.now()` inside queries.
8. **Don't commit `compiler/dist`.** Build outputs are generated.

## Fast paths

```bash
npm ci
npm run stack:doctor
npm run stack                  # full local stack
npm run typecheck
npm run test                   # compiler + golden
npm run golden                 # all cards/*.card
```

Env templates: `.env.example`, `web/.env.example`, `fetcher/.env.example`, `emulator/.env.example`.

Demo device token: `dev-token-matrix-panel-demo`. Dashboard secret: `dashboard-secret`.

## Where to edit what

| Change | Primary place |
|---|---|
| New / edit card UI | `cards/*.card` + golden |
| Language / bytecode | `compiler/src/*`, then `libmxr/*` if new opcodes |
| Raster / fonts / effects | `libmxr/*.c` (+ rebuild WASM if needed) |
| Device HTTP / schema | `convex/http.ts`, `convex/schema.ts`, related modules |
| Dummy / real Seoul sources | `fetcher/src/plugins/*` |
| Dashboard UX | `web/src/routes/*`, `web/src/lib/dashboard/*` |
| Firmware behaviour | `firmware/main/*` (many sensors/HUB75/HomeKit are stubs — see roadmap) |
| Local orchestrator | `scripts/dev-stack.mjs`, `scripts/bootstrap-local.mjs` |

## Intentional stubs (do not "fix" by deleting)

These are documented incomplete hardware/prod edges — replace with real drivers/keys, don't pretend they're bugs:

- `firmware/main/matrix_refresh.cpp` — HUB75 no-op without panel
- `firmware/main/sensors.cpp` — synthetic stubs
- `firmware/main/homespan_panel.cpp` — disabled unless `CONFIG_MX_HOMESPAN`
- OTA unsigned / sha256 stand-in — demo only
- Fetcher + Convex dummy payloads — until API keys exist
- TS icon assets stub warning in web fallback renderer

## Docs ownership

| Audience | Doc |
|---|---|
| First run | `docs/getting-started.md` |
| Ops / deploy | `docs/operations.md` |
| Design plan / BOM | `docs/plan.md` |
| What's left | `docs/roadmap.md` |

Keep the root `README.md` short and punchy. Put depth in `docs/`.

## PR expectations

- Run `npm run typecheck` and `npm run test` (or note why not).
- Card changes must keep `npm run golden` green.
- Prefer focused diffs; don't reformat unrelated files.
- Update `docs/roadmap.md` if you complete or add a stubbed area.
