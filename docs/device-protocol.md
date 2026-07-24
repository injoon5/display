# Device protocol

The panel (and the local emulator) talk to Convex **HTTP actions** on `CONVEX_SITE_URL`. No MQTT. No WebSocket from the device.

Auth: `Authorization: Bearer <device-token>`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/device/wait` | ETag long/short-poll (~10s hold locally; reconnect on timeout) |
| `GET` | `/device/sync` | Program manifest + bytecode URL + brightness ceiling |
| `GET` | `/device/data` | Slot frame — JSON default; CBOR if `Accept` prefers it |
| `POST` | `/device/heartbeat` | Telemetry (RSSI, heap, lux, presence, amps, …) |
| `POST` | `/api/pin` | Pin a card for N ms |
| `POST` | `/api/scene` | Force active scene |
| `POST` | `/api/poke` | Takeover / interrupt message |
| `GET` | `/api/health` | Service health |

Implementation: [`convex/http.ts`](../convex/http.ts). Emulator client: [`emulator/src/device-client.ts`](../emulator/src/device-client.ts). Firmware: [`firmware/main/net_sync.cpp`](../firmware/main/net_sync.cpp).

## Sync loop (device)

```
boot → load last-good program+slots from SPIFFS → paint immediately
     → Wi-Fi connect (background)
     → loop:
          GET /device/wait?etag=<programEtag>,<dataEtag>
          if program changed → GET /device/sync → download bytecode → atomic swap
          if data changed    → GET /device/data → patch slots → paint
          every N s          → POST /device/heartbeat
```

Retry policy (firmware): `1 → 2 → 4 → 8 → 16 → 30s` with ±20% jitter; hard reboot after ~10 minutes of continuous failure.

## `/device/sync` shape (conceptual)

```json
{
  "programVersion": 42,
  "programEtag": "…",
  "bytecodeUrl": "https://…/storage/…",
  "brightnessCeiling": 1.0,
  "playlist": { "cardId": "…", "dwellMs": 10000 }
}
```

Program bytes live in Convex file storage (`programStorageId` is the source of truth on the device row).

## `/device/data` slot frame

Prefer CBOR on-device (`Accept: application/cbor, application/json`). Compact map shape:

| Key | Meaning |
|---|---|
| `v` | data version |
| `t` | server time / fetched markers |
| `s` | slot values |
| `a` | aux / ambient bits |

Firmware accepts JSON when `Content-Type` looks like JSON or the body starts with `{`.

## Offline behaviour (P4)

| Condition | Panel behaviour |
|---|---|
| No network since boot | Last-good program + cached slots; dim 1px marker at `(63,0)` |
| Data stale | Frame dimmed (~50%) / grey per `<stale>` |
| Sync fails | Exponential backoff; never blank, never error string |

Staleness is measured from **device uptime at last live frame**, not wall-clock — correct without NTP.

## Control plane mirror

Dashboard / Shortcuts / HomeKit automation can hit `/api/pin|scene|poke` with the dashboard secret. LAN HomeKit (when enabled) does on/off/brightness/scene **without** these routes.

## Local URLs

```bash
CONVEX_SITE_URL=http://127.0.0.1:3211
DEVICE_TOKEN=dev-token-matrix-panel-demo
```

Smoke with the emulator:

```bash
npm run stack -- --no-web
# preview: http://127.0.0.1:8787
# ready:   http://127.0.0.1:8787/readyz
```

## Deep dive

Plan §8.4–8.5 cover the full sync + offline design: [plan §8](./plan.md#8-firmware).
