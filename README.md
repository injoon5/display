# Wall Matrix Panel

**A 64×32 RGB LED matrix that is a renderer, not a computer.**

Cards compile to bytecode. One C99 rasteriser runs on the ESP32 *and* in your browser. Convex is the brain. HomeKit is the light switch. No MQTT. Seoul bus ETAs on your wall.

```bash
npm ci && npm run stack
```

Then open **http://127.0.0.1:5173** (dashboard) and **http://127.0.0.1:8787** (device emulator painting real `libmxr` frames).

No hardware. No cloud account. Dummy Korean APIs. The whole content plane is emulatable on a laptop.

---

## Why this repo is shaped like this

| Principle | Meaning |
|---|---|
| **Device = renderer** | Panel executes MXR1 bytecode. No JSON schema logic on the ESP32. |
| **One renderer, twice** | `libmxr` → firmware + WASM/native. Preview is byte-identical, not "close enough". |
| **Control ≠ content** | HomeKit/LAN works with the internet unplugged. Cards/data come from the cloud. |
| **Degrade quietly** | Offline shows last-good art + a dim corner pixel. Never an error string on the wall. |
| **Invalid = unrepresentable** | Broken cards fail at compile time. The panel never sees them. |

Locked stack: **Matrix Portal S3 · Convex · Oracle ICN fetcher · SvelteKit · HomeSpan · no MQTT**.

---

## Docs (start here)

| Doc | Use it for |
|---|---|
| **[docs/getting-started.md](./docs/getting-started.md)** | Cold clone → running stack |
| **[docs/architecture.md](./docs/architecture.md)** | How the system fits |
| **[docs/operations.md](./docs/operations.md)** | Build, run, deploy, debug |
| **[docs/roadmap.md](./docs/roadmap.md)** | What's shipped vs left after hardware |
| **[docs/mxml.md](./docs/mxml.md)** | Write cards |
| **[docs/device-protocol.md](./docs/device-protocol.md)** | `/device/*` HTTP |
| **[docs/packages.md](./docs/packages.md)** | Monorepo map |
| **[docs/plan.md](./docs/plan.md)** | Full hardware/BOM/enclosure/HomeKit design plan |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** · **[AGENTS.md](./AGENTS.md)** | Humans & coding agents |

---

## Repo map

```
cards/        22 Stage 1 MXML cards (the product surface)
compiler/     MXML → MXR1
libmxr/       C99 bytecode VM + rasteriser (ESP32 + WASM + native)
convex/       schema, device HTTP, compile/deploy, crons
fetcher/      Seoul ICN poller (dummy plugins until you add keys)
emulator/     fake Matrix Portal speaking real /device/*
web/          SvelteKit dashboard + live preview
firmware/     ESP-IDF Matrix Portal S3 skeleton
cad/          OpenSCAD enclosure parts
scripts/      npm run stack orchestrator
docs/         you are here
```

---

## Everyday commands

```bash
npm run stack              # Convex + seed + fetcher + web + emulator
npm run stack:doctor       # tooling check
npm run test               # compiler + golden cards through libmxr
npm run typecheck
npm run golden             # all 22 cards must compile clean
npm run emulate            # device emulator alone
npm run bootstrap          # seed/deploy against running convex dev
```

Demo secrets (local only): device `dev-token-matrix-panel-demo` · dashboard `dashboard-secret`.

---

## Status in one breath

**Software path: shipped and emulatable.**  
**Hardware path: buy the BOM, flash the skeleton, replace stubs.**

Left after hardware (and API/signing keys): HUB75 driver, real sensors, HomeSpan enabled build, production ed25519 OTA, live TOPIS/KMA/AirKorea (and friends), print-fit the enclosure. Full breakdown → **[docs/roadmap.md](./docs/roadmap.md)**.

---

## Card taste

```xml
<card id="clock" name="Clock" priority="64">
  <text x="3" y="9" font="8x16" color="#f0f0f0">{{ now.hhmm | default('00:00') }}</text>
  <stale after="2m" style="dim" />
</card>
```

Edit in the dashboard. Preview updates every keystroke. Deploy bumps an ETag. The emulator (or the wall) long-polls and swaps atomically.

---

MIT · [injoon5/display](https://github.com/injoon5/display)
