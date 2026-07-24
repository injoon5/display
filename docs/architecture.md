# Architecture

A 64×32 RGB LED wall panel for a Seoul bedroom — production-shaped software, appliance-grade reliability goals, zero MQTT.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             CONTENT PLANE                                 │
│                                                                           │
│  Korean APIs           ┌────────────────┐        ┌──────────────────┐    │
│  data.go.kr    ◄──────►│  Oracle  ICN   │───────►│                  │    │
│  KMA / AirKorea        │  fetcher (KR)  │        │                  │    │
│  TOPIS bus             └────────────────┘        │   Convex Cloud   │    │
│                                                   │                  │    │
│  Global APIs   ◄───────── Convex actions ────────►│  • schema/data   │    │
│  Spotify, GitHub,         (crons)                 │  • compiler      │    │
│  Google Calendar                                  │  • crons         │    │
│                                                   │  • HTTP actions  │    │
│  ┌─────────────────┐                              │  • file storage  │    │
│  │ SvelteKit       │◄──── reactive queries ──────►│                  │    │
│  │ dashboard       │                              └────────┬─────────┘    │
│  │  + WASM preview │                                       │              │
│  └─────────────────┘                              HTTPS poll│ + long-poll │
│                                                             ▼             │
│  ┌─────────────┐   signed firmware/assets          ┌──────────────────┐   │
│  │ Cloudflare  │◄───────────────────────────────── │  Matrix Portal   │   │
│  │ R2          │───────────────────────────────────►│       S3         │   │
│  └─────────────┘                                   │  • bytecode VM   │   │
└────────────────────────────────────────────────────│  • HomeSpan HAP  │───┘
                                                     │  • sensors       │
┌────────────────────────────────────────────────────└──────────────────┘
│                CONTROL PLANE (LAN only)                                    │
│  iPhone / HomePod ──── HAP over Wi-Fi ───────────────────────────────────┘
│  (on/off, brightness, scenes, occupancy) — works with internet down
└──────────────────────────────────────────────────────────────────────────┘
```

Locally, the Matrix Portal is replaced by `emulator/` which speaks the same `/device/*` protocol and paints frames with native `libmxr`.

## Locked stack

| Layer | Choice | Why |
|---|---|---|
| Device | Adafruit Matrix Portal S3 | Dual-core ESP32-S3, PSRAM, A/B OTA, BLE |
| Renderer | `libmxr` C99 | One codebase → firmware + WASM/native preview |
| Cards | MXML → MXR1 bytecode | Invalid cards never reach the panel |
| Backend | Convex | Schema, crons, HTTP long-poll, file storage, reactive dashboard |
| KR APIs | Oracle Always Free ICN fetcher | Seoul latency + disposable box |
| Dashboard | SvelteKit | Live WASM/TS preview, CodeMirror editor |
| HomeKit | HomeSpan (skeleton) | LAN control plane, no cloud for on/off |
| Transport | HTTPS long-poll | **No MQTT** — retained msgs, LWT, QoS replaced by Convex |

Deep design rationale (why no MQTT, power governor, mmWave vs load cell, etc.) lives in the [full plan](./plan.md).

## Data flow (happy path)

1. **Edit** a `.card` in the dashboard. Browser compiles with `@matrix-panel/compiler` and renders via WASM/`libmxr` (or TS fallback) at every keystroke — no server round trip while typing.
2. **Deploy** → Convex mutation stores bytecode in file storage, bumps `programVersion`, recomputes ETag.
3. Device (or emulator) is sitting on `GET /device/wait?etag=…`. Server returns immediately when the etag changes.
4. Device calls `GET /device/sync`, downloads bytecode, swaps atomically.
5. Seoul fetcher (or Convex crons) writes source payloads. Slot values change → `dataVersion` bumps.
6. Device pulls `GET /device/data` (~150 B CBOR/JSON slot frame). **No recompile.** Only affected slots update.

## Package roles

```
cards/        Stage 1 MXML sources (22 cards) — the product surface
compiler/     MXML → MXR1 (Stage 0 JSON + Stage 1 .card + Stage 2 packing)
libmxr/       C99 VM + rasteriser + fonts + gamma + effects
convex/       schema, device HTTP, compile/deploy, crons, seed
fetcher/      Oracle ICN Node process (dummy plugins today)
emulator/     fake device: /device/* client + C-rendered PPM → preview
web/          SvelteKit dashboard (cards, scenes, rules, sources, firmware)
firmware/     ESP-IDF Matrix Portal S3 skeleton + host_sim
cad/          OpenSCAD enclosure parts
scripts/      stack orchestrator, golden tests, bootstrap
```

See [packages](./packages.md) for scripts and ownership.

## Invariants worth dying for

1. **Preview == device.** If WASM and firmware diverge, rebuild `libmxr` — never hand-edit the wasm glue.
2. **Compiler is the gate.** Broken cards fail with diagnostics; the panel never parses MXML.
3. **Program source of truth** is `devices.programStorageId` (bytecode in Convex storage), not a loose string on the device row.
4. **Degrade quietly.** Offline → last-good frame + dim corner pixel. Stale → grey/dim. Never error strings on-panel.
5. **Control ≠ content.** HomeKit/LAN works when Convex is unreachable.

## Auth model (local vs prod)

| Actor | Local demo | Production intent |
|---|---|---|
| Device | Bearer `dev-token-matrix-panel-demo` | Per-device token hashed in `devices.tokenHash` |
| Dashboard | shared secret `dashboard-secret` | Convex auth / WorkOS-style identity |
| Fetcher | public mutations or admin auth if `CONVEX_SERVICE_TOKEN` / `CONVEX_DEPLOY_KEY` | Service token only |

## Related

- [Device protocol](./device-protocol.md)
- [Operations](./operations.md)
- [Plan §2](./plan.md#2-system-architecture)
