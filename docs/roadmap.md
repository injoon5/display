# Roadmap — shipped vs left to do

Honest status. The software path runs end-to-end locally with dummy APIs and a C-rendered emulator. Hardware and a few production edges are still stubs.

## What's done (you can use this today)

| Area | Status |
|---|---|
| `libmxr` C99 VM + rasteriser + fonts/gamma/effects | Done — native + firmware link + optional WASM |
| MXML compiler Stage 0 / 1 / 2 packing | Done — `@matrix-panel/compiler` |
| 22 Stage 1 catalogue cards + golden tests | Done — `npm run golden` |
| Convex schema, seed, compile/deploy, playlists | Done |
| Device HTTP (`/device/wait|sync|data|heartbeat`, `/api/*`) | Done |
| Seoul fetcher with dummy plugins + Docker compose | Done |
| Device emulator (real protocol + `render_ppm` preview) | Done |
| SvelteKit dashboard (cards, scenes, rules, sources, firmware, provision) | Done |
| `npm run stack` one-command local DX | Done |
| Firmware skeleton (tasks, net sync, offline cache, OTA packaging, power governor hooks) | Scaffold done |
| CAD OpenSCAD sources | Done (print-fit iteration remains) |
| CI workflows (ci / cards / firmware / wasm) | Present |

## What's left — after you have hardware (and keys)

Ordered roughly by "unblock the wall appliance," not by calendar weeks.

### A. Light it up on real silicon

1. **HUB75 / Protomatter (or ESP-IDF HUB75) driver** — `matrix_refresh.cpp` is an intentional no-op stub without a panel. Wire core-0 BAM refresh; prove tear-free clock with Wi-Fi on core 1.
2. **Flash Matrix Portal S3** — `idf.py build flash monitor`; confirm first-pixel-from-SPIFFS-cache path.
3. **Power path** — real 5 V supply, measure amps, calibrate **power governor** against worst-case full-white.
4. **Auto-brightness** — replace `stub_lux` with VEML7700; hysteresis + HomeKit ceiling semantics.

### B. Sensors → real drivers

| Stub today | Replace with |
|---|---|
| `stub_lux` | VEML7700 I²C |
| `stub_temperature` / `stub_humidity` | SHT41 |
| `stub_ld2410_presence` | LD2410C UART (gate max distance) |
| LIS3DH INT1 edge stub | Full double-tap click-detect → advance card |

Tune mmWave per [plan §8.9](./plan.md#89-mmwave-tuning). Room presence only — no bed load cell.

### C. Enclosure & mount

1. Print **pixel grid tiles** alone; dial wall thickness/depth on the bare panel.
2. Print bezel halves, rear shell, French cleat, mmWave radome (`cad/`).
3. Diffusion acrylic + adhesive; furniture-mounted cleat (not the flap door) — [plan §5–6](./plan.md#5-enclosure--3d-printing).
4. Reprint in ASA if PLA bows in summer heat.

### D. Real data (replace dummies)

| Source | Action |
|---|---|
| TOPIS / Seoul bus | data.go.kr key + `arsId`; raise quota |
| Seoul subway | data.seoul.go.kr key |
| KMA now / forecast / nowcast / quake | data.go.kr; hardcode `nx`/`ny` |
| AirKorea | station name + key |
| Spotify / GitHub / Calendar / FX | Convex actions + OAuth/tokens |
| Todo / D-day | your source of truth (or keep ambient stubs) |

Fetcher stays on Oracle ICN; Convex keeps global APIs. Circuit breakers already exist — exercise them.

### E. HomeKit / LAN control (no Arduino)

**Hard rule: do not add Arduino-as-component or HomeSpan.** Firmware stays pure ESP-IDF.

1. **Ship control plane without native HAP first** — iPhone Shortcuts / dashboard → `POST /api/pin|scene|poke` (already in Convex). On/off + scene select work over HTTPS on the LAN/VPN.
2. **Optional later: native HomeKit on ESP-IDF only** — Apple HomeKit ADK / an IDF-native HAP stack on core 1. Service set: lightbulb, room occupancy, temp/humidity/light, scene TV inputs. Never pull Arduino.
3. Pair / automate; **verify NVS survives OTA twice** if HAP pairing state lives there.
4. Pin HAP + networking to **core 1**; matrix stays on core 0.
5. Optional: Direction B (show other accessories on-panel) via a backend controller — [plan §9](./plan.md#9-homekit--lan-control).

The `CONFIG_MX_HOMESPAN` / `homespan_panel.cpp` path is a **dead stub** left behind from an earlier plan — leave it off; replace with IDF-native code or delete when you implement HAP.

### F. Production hardening

- [ ] A/B OTA with `esp_ota_mark_app_valid_cancel_rollback()` within 60s
- [ ] Real **ed25519** OTA signatures (`CONFIG_MX_OTA_ALLOW_UNSIGNED=0`, bake pubkey, set `OTA_SIGNATURE` in `release.sh`)
- [ ] BLE Wi-Fi provisioning (no serial secrets)
- [ ] Watchdog + offline push alert when heartbeat dies
- [ ] CI PNG snapshot diffs for every card on every commit (workflow skeleton exists — make visual review mandatory)
- [ ] Dashboard device mirror always beside the live preview
- [ ] `esp_wifi_set_ps(WIFI_PS_NONE)` on mains power

Full reliability list: [plan §17](./plan.md#17-reliability-checklist).

### G. Optional software polish

- MXML Stage 2 as default authoring style for new cards (packing already in compiler)
- `<each>` only if hand-unrolled `<when>` actually hurts
- Multi-device households / auth beyond demo shared secret
- Better Stack (or similar) uptime → phone

## Phase map (from the original plan)

| Phase | Intent | Repo reality |
|---|---|---|
| 1 Light it up | Desk clock, no tear | **Needs hardware** — HUB75 stub |
| 2 Renderer | `libmxr` + identical preview | **Done** |
| 3 / 3b Pipeline + Stage 1 | Convex + fetcher + MXML | **Done** (dummy APIs) |
| 4 Dashboard + simulate | SvelteKit live preview | **Done** (iterate UX forever) |
| 5 Enclosure | Print + mount | CAD done; **print/fit left** |
| 6 HomeKit / LAN control | Shortcuts + `/api/*` now; IDF-native HAP later | **No Arduino / HomeSpan** |
| 7 Hardening | OTA, BLE, governor, CI snaps | **Partial** — hooks in place |
| 7b Stage 2 packing | row/col | **Compiler ready**; optional adoption |
| 8 Forever | Add cards without firmware | **Working path** via dashboard + deploy |

## Definition of "appliance done"

You're done when:

1. Panel boots to last-good art in &lt;400ms with Wi-Fi down
2. Siri / Shortcuts / dashboard can turn the panel off with the content plane unreachable (LAN `/api/*` today; optional IDF-native HAP later — **no Arduino**)
3. Bus card goes red at 3 minutes using **live** TOPIS data
4. OTA can never brick you from the couch (rollback + signed images)
5. You add a card on Friday night without touching C or a soldering iron

Until then: `npm run stack` is the product. Ship cards against the emulator; treat firmware stubs as a checkout lane, not a mystery.
