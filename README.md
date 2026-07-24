# Wall Matrix Panel — Full Build Plan

> **Software implementation:** see [`SOFTWARE.md`](./SOFTWARE.md) and [`CONTRIBUTING.md`](./CONTRIBUTING.md).  
> This repo contains the full software stack from the plan below (`libmxr`, MXML compiler, Convex, Seoul fetcher, SvelteKit dashboard, ESP-IDF firmware skeleton, card catalogue, CAD, CI). External Korean APIs use **dummy data** until keys are configured. Hardware drivers (HUB75 / sensors / HomeKit) and production OTA signing remain skeleton/demo until keys and hardware are available.

A 64×32 RGB LED matrix display for a Seoul bedroom, with a production-grade backend, a
dashboard-authored card templating language, native HomeKit integration, and appliance-grade
reliability.

**Locked decisions:** Matrix Portal S3 · Convex · Oracle Cloud ICN · no MQTT · SvelteKit ·
native HomeKit via HomeSpan · mmWave + load-cell presence · furniture-mounted.

---

## Table of contents

1. [Principles](#1-principles)
2. [System architecture](#2-system-architecture)
3. [Hardware](#3-hardware)
4. [Bill of materials](#4-bill-of-materials)
5. [Enclosure & 3D printing](#5-enclosure--3d-printing)
6. [Mounting](#6-mounting)
7. [Power](#7-power)
8. [Firmware](#8-firmware)
9. [HomeKit integration](#9-homekit-integration)
10. [MXML — the card templating engine](#10-mxml--the-card-templating-engine)
11. [Bytecode specification](#11-bytecode-specification)
12. [Backend — Convex](#12-backend--convex)
13. [The Seoul fetcher — Oracle Cloud (ICN)](#13-the-seoul-fetcher--oracle-cloud-icn)
14. [Dashboard — SvelteKit](#14-dashboard--sveltekit)
15. [Scenes & rules](#15-scenes--rules)
16. [Card catalogue](#16-card-catalogue)
17. [Reliability checklist](#17-reliability-checklist)
18. [Hosting, deploy & cost](#18-hosting-deploy--cost)
19. [Build roadmap](#19-build-roadmap)
20. [Appendices](#20-appendices)

---

## 1. Principles

Five rules that resolve every later argument.

**P1 — The device is a renderer, not a computer.**
It executes a compact bytecode display list and nothing else. No template parsing, no JSON
schema logic, no scripting engine on the ESP32. All intelligence is compile-time and
server-side. This is what keeps the firmware stable for years while cards change weekly.

**P2 — One renderer, compiled twice.**
The rasteriser is plain C99 with zero platform dependencies. It compiles to ESP32 native
firmware *and* to WASM for the dashboard preview. The browser preview is byte-identical to the
panel, not "similar". This eliminates an entire category of bug permanently.

**P3 — Control plane is local; content plane is cloud.**
On/off, brightness, scene selection and sensor readings work with the internet unplugged, over
HomeKit on the LAN. Cards, data and deploys come from the cloud. They fail independently.

**P4 — Degrade quietly.**
Network loss shows last-known content with a single dimmed corner pixel. Never an error string,
never a QR code, never a blank panel. Stale data greys out; it does not disappear.

**P5 — Invalid states are unrepresentable at compile time.**
A card that references a non-existent field, overflows 64×32, or exceeds the power budget fails
in the editor with a red squiggle. The panel never sees a broken card.

---

## 2. System architecture

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
│  │ (CF Pages)      │                                       │              │
│  │  + WASM preview │                              HTTPS poll│ 15s         │
│  └─────────────────┘                              + long-poll│            │
│                                                             ▼             │
│  ┌─────────────┐   signed firmware/assets          ┌──────────────────┐   │
│  │ Cloudflare  │◄───────────────────────────────── │                  │   │
│  │ R2          │───────────────────────────────────►│  Matrix Portal   │   │
│  └─────────────┘                                   │       S3         │   │
└────────────────────────────────────────────────────│                  │───┘
                                                     │  • bytecode VM   │
┌────────────────────────────────────────────────────│  • HomeSpan HAP  │
│                CONTROL PLANE (LAN only)            │  • sensors       │
│                                                     └──────────────────┘
│  iPhone / HomePod ──── HAP over Wi-Fi ─────────────────────┘
│  (on/off, brightness, scenes, occupancy, temp, lux)
│  Works with the internet completely down.
└──────────────────────────────────────────────────────────────────────────┘
```

### Why no MQTT

The broker existed to give push latency and offline detection. With Convex we get both cheaper:

| MQTT feature | Replacement |
|---|---|
| Retained message | `GET /device/sync` returns current program on every boot |
| Push latency | HTTP long-poll (`/device/wait`, 25 s hold) — sub-second |
| Last Will & Testament | Convex cron: no heartbeat in 90 s → mark offline, push alert |
| QoS 1 | Device ACKs the program hash; server retries until it matches |
| TLS + auth | Bearer token over HTTPS; already there |

Deleting the broker removes a long-lived TCP service, its certificates, its ACL config, its
persistence volume and its ops burden. The only cost is ~200 ms of worst-case push latency,
which no card needs.

### Data flow, end to end

1. You edit a card in the dashboard. It compiles **in the browser** (shared TS package) and
   renders through **WASM** at every keystroke. Zero server round trips while editing.
2. You hit Deploy. A Convex mutation stores the bytecode, bumps `programVersion`, computes an
   ETag.
3. The device is sitting in a long-poll on `/device/wait?etag=<current>`. The server returns
   immediately. Device fetches `/device/sync`, writes bytecode to flash, swaps atomically.
4. Meanwhile the Oracle ICN fetcher polls the bus API every 20 s and writes results into Convex via
   the Convex HTTP client. Convex diffs the slot values; if changed, it bumps `dataVersion`.
5. Device long-polls for data on the same channel and pulls a ~150 byte CBOR slot frame.
   No recompile. No re-render of anything but the affected slots.

---

## 3. Hardware

### 3.1 Controller

**Adafruit Matrix Portal S3** (#5778 PCB antenna, or #6475 for u.FL external antenna).

Non-negotiable over the M4 that ships in ADABOX 016. The M4 is a SAMD51 with an ESP32 bolted on
as a Wi-Fi coprocessor over SPI, ~192 KB RAM, CircuitPython-oriented. You need:

- **2 MB PSRAM** — double-buffered framebuffer + display list + asset cache, with headroom
- **8 MB flash** — A/B OTA partitions, asset bundle, HomeKit pairing NVS
- **Native ESP32-S3** — esp-idf, mbedTLS, `esp_https_ota` with automatic rollback
- **Dual core** — HUB75 bit-angle modulation pinned to core 0, everything else on core 1
- **BLE** — zero-touch Wi-Fi provisioning from your phone
- **Onboard LIS3DH** — tap-to-advance, no buttons in the bezel
- **STEMMA QT + UART breakout** — sensors without soldering

Take **#6475 with an external antenna** if the panel ends up recessed in furniture. RF through a
wood door plus a ground-plane-heavy LED PCB is a real signal loss.

### 3.2 Panel

**Adafruit #2278** — 64×32, 4 mm pitch, 256 × 128 mm, HUB75E. 2048 RGB LEDs.

### 3.3 Sensors

| Sensor | Part | Bus | Purpose |
|---|---|---|---|
| Ambient light | VEML7700 (#4162) | I²C | Auto-brightness. The single most important sensor. |
| Temp + humidity | SHT41 (#4885) | I²C | Indoor climate card, HomeKit sensors |
| Room presence | **LD2410C** | UART1 | Static presence — someone is in the room |
| Room zones | LD2450 *(optional)* | UART2 | x/y tracking — desk vs bed vs door |
| Bed occupancy | HX711 + 50 kg load cell | GPIO | Binary, unambiguous, never wrong |
| Orientation / tap | LIS3DH (onboard) | I²C | Tap frame to advance card |
| RTC *(optional)* | PCF8523 (#5189) | I²C | Clock survives multi-day outages |

**On the mmWave choice.** LD2410C over LD2450 for presence: the 2410 treats *stationary target
energy per distance gate* as a first-class concept with independent per-gate sensitivity. The
2450 is a tracking radar — better at zones, worse at holding a motionless target. If you want
both, run both; they're ~₩7,000 each and the S3 has spare UARTs.

**On bed detection.** Radar measures velocity along the beam axis. Breathing moves your chest
vertically; a sensor at the foot of the bed looks horizontally, so the radial component is tiny.
It will be flaky. **The load cell under one bed leg is unambiguous, has zero false positives,
and costs ₩10,000.** Use radar for the room, the load cell for the bed.

If you want radar-only bed sensing anyway: mount an LD2410C on the wall above the headboard on a
1 m lead, angled ~30° down at your torso, so chest motion is along the beam.

---

## 4. Bill of materials

### 4.1 Adafruit — core

| SKU | Item | Qty | Unit | Line |
|---|---|---:|---:|---:|
| 5778 / 6475 | Matrix Portal S3 | 1 | $24.95 | $24.95 |
| 2278 | 64×32 RGB Matrix, 4 mm pitch | 1 | $39.95 | $39.95 |
| 4749 | LED Diffusion Acrylic, black, 10.2″×5.1″ | 1 | $9.95 | $9.95 |
| 4813 | Adhesive squares | 1 | $2.50 | $2.50 |
| 4298 | RPi 5.1 V 3 A USB-C supply, 1.5 m | 1 | $7.95 | $7.95 |
| | | | **Subtotal** | **$85.30** |

*PSU alternative:* #1466 (5 V 4 A, 2.1 mm barrel, $14.95) + barrel→USB-C adapter. More headroom,
uglier cable chain, and the plug is US 2-prong so you'll need a KR adapter. The #4298 is cleaner
and its 5.1 V deliberately compensates for cable IR drop — which matters, because HUB75 panels
show colour shift before they brown out.

### 4.2 Adafruit — sensors & wiring

| SKU | Item | Qty | Unit | Line |
|---|---|---:|---:|---:|
| 4162 | VEML7700 ambient light, STEMMA QT | 1 | $4.95 | $4.95 |
| 4885 | SHT41 temp/humidity, STEMMA QT | 1 | $4.95 | $4.95 |
| 5625 | STEMMA QT 5-port I²C hub | 1 | $4.95 | $4.95 |
| 4210 | STEMMA QT cable, 100 mm | 3 | $0.95 | $2.85 |
| 4399 | STEMMA QT cable, 200 mm | 1 | $1.25 | $1.25 |
| 5189 | PCF8523 RTC, STEMMA QT *(optional)* | 1 | $4.95 | $4.95 |
| 4527 | USB-C right-angle adapter | 1 | $2.95 | $2.95 |
| 3299 | Nylon screw & standoff set *(optional)* | 1 | $16.95 | $16.95 |
| | | | **Subtotal** | **$43.80** |

### 4.3 Non-Adafruit

| Item | Qty | Est. | Source |
|---|---:|---:|---|
| **LD2410C** 24 GHz mmWave module | 1 | ₩7,000 | 알리 / 디바이스마트 |
| LD2450 mmWave tracking module *(optional, zones)* | 1 | ₩10,000 | 알리 |
| HX711 amp + 50 kg half-bridge load cell | 1 | ₩10,000 | 알리 / 엘레파츠 |
| JST-PH 1.25 mm 4-pin cable, 300 mm (mmWave) | 2 | ₩2,000 | |
| Bambu **ASA Black** 1 kg *(enclosed/warm mount)* | 1 | ₩45,000 | Bambu KR |
| Bambu **Matte PLA Charcoal** 1 kg *(cool mount only)* | 1 | ₩33,000 | Bambu KR |
| Bambu **PETG-HF Black** 1 kg *(pixel grid, cleats)* | 1 | ₩38,000 | Bambu KR |
| M3 brass heat-set inserts, 4.0 × 5 mm ×50 | 1 | ₩6,000 | |
| M3 socket screws, black, 8/12/16 mm assortment | 1 | ₩8,000 | |
| 3M VHB 5952 tape, 12 mm × 3 m | 1 | ₩12,000 | |
| Silicone-jacket USB-C cable, 1 m *(flexible)* | 1 | ₩10,000 | |
| Light-diffusing film / 0.5 mm white PP sheet *(optional)* | 1 | ₩5,000 | |
| Matte anti-glare screen film, A5 *(optional)* | 1 | ₩8,000 | |
| Cord raceway 10 mm, 1 m *(only if wall-mounted)* | 1 | ₩6,000 | 다이소 |
| | | **≈ ₩167,000** | |

### 4.4 Totals

| | |
|---|---:|
| Adafruit (core + sensors, incl. optionals) | **≈ $129** |
| Local parts & filament | **≈ ₩167,000** |
| Cloud hosting, year 1 | **$0** (Convex free tier, Oracle Always Free ICN, Cloudflare — see §18.1) |
| **Approx. total** | **≈ ₩350,000 / $255** |

Excluding printer time. Drop the optional RTC, LD2450, standoff set, and second filament roll
and it's closer to ₩260,000.

---

## 5. Enclosure & 3D printing

### 5.1 The optical stack

This is where most builds fail. Raw HUB75 looks cheap because you see 2048 round dots on a
grey-green PCB.

```
  ROOM
   ▲
   │  ┌──────────────────────────────┐  ← matte anti-glare film (optional)
   │  │  2 mm black cast acrylic     │  ← Adafruit #4749: contrast filter
   │  ├──────────────────────────────┤
   │  │  0.5 mm diffusing film       │  ← optional; kills hotspots
   │  ├──────────────────────────────┤
   │  │  2.5–3 mm printed pixel grid │  ← THE upgrade
   │  ├──────────────────────────────┤
   │  │  LED PCB (Adafruit #2278)    │
   │  ├──────────────────────────────┤
   │  │  Matrix Portal S3 + sensors  │
   │  └──────────────────────────────┘
```

**The pixel grid** is a 64×32 honeycomb of 4 mm cells with ~0.4 mm walls, sitting directly on the
PCB. Each LED gets its own optical well. Every lit pixel becomes a crisp square instead of a
blurry dot, and adjacent pixels stop bleeding. It is the single difference between "LED sign"
and "display", and it costs ₩3,000 of filament.

**Depth is a viewing-angle tradeoff:**

| Grid depth | Half-angle | Use when |
|---|---|---|
| 2.0 mm | ~45° | Viewed from a wide range of positions, close range |
| 2.5 mm | ~39° | **Recommended default** for a bedroom |
| 3.0 mm | ~34° | Fixed head-on viewing across a room |
| 3.5 mm | ~30° | Maximum crispness, narrow cone |

**Black acrylic on the front is load-bearing for the look**, not just protection. It absorbs
ambient light hitting the dark PCB so unlit pixels read as true black. Never substitute clear
acrylic. Keep the protective film on the *inner* face until final assembly — fingerprints
between layers are unfixable.

**Glare:** a bedroom lamp will reflect. Either buy non-glare acrylic or apply a matte anti-glare
screen protector to the outer face. Do not sand it; you'll fog it unevenly.

### 5.2 The build-plate constraint

**The panel is exactly 256 × 128 mm. The P1S plate is 256 × 256 mm with ~250 × 250 usable.**
A frame wrapping the panel is ~272 × 144 mm outer. **It will not fit on X or Y.**

Solution: print the long parts **rotated 45°**. The plate diagonal is 353 mm, so a 272 × 40 mm
strip drops in with room to spare.

### 5.3 Printed parts

| # | Part | Split | Material | Notes |
|---|---|---|---|---|
| 1 | Front bezel | 2 × L-halves, printed at 45° | ASA / Matte PLA | 3 mm face, 7 mm visible border, joined at opposite corners with dovetail + M3 from behind |
| 2 | Pixel grid | **8 tiles, 16×16 px (64×64 mm)** | PETG-HF Black | Tile seams land on cell walls — invisible |
| 3 | Rear shell | 1 piece | ASA / PLA | Vent grille above the Portal, 2 mm standoff so the HUB75 ribbon isn't crushed |
| 4 | Portal retainer clip | 1 | PETG | Presses the Portal onto the IDC header. Prevents shock-loosening |
| 5 | Sensor window plug | 1 | Clear PETG | Flush window for VEML7700, bottom bezel |
| 6 | mmWave radome | 1 | PETG, 1.0 mm wall | 24 GHz passes through thin plastic, not metal or thick acrylic |
| 7 | Cleat, wall/carcass half | 1 | PETG-HF | 30° bevel, slotted screw holes, bubble-level pocket |
| 8 | Cleat, panel half | 1 | PETG-HF | Built-in downward tilt (see §6) |
| 9 | Cable strain relief | 1 | PETG | Right-angle exit, bottom-centre |
| 10 | Load-cell foot cup | 1 | PETG | Seats a bed leg on the load cell |

### 5.4 Print settings

| Setting | Value | Why |
|---|---|---|
| Bezel layer height | 0.16 mm | Visible surface |
| Bezel orientation | Face down on **textured PEI** | The plate texture becomes your finish — reads as manufactured |
| Grid nozzle / layers | 0.4 mm / 0.2 mm | |
| Grid wall count | **1** | Single-extrusion 0.42 mm walls |
| Grid infill | 0% | It's all walls |
| Grid material | **PETG-HF or ASA black** — *not* translucent black PETG | Light bleed between cells |
| Inserts | M3 brass, 4.0 mm OD × 5 mm | Anywhere you'll unscrew twice |

**Material decision — read this before printing.** If the panel ends up in an enclosed
compartment, or on a wall that gets summer sun, use **ASA or PETG-HF**. A closed cabinet with
~5 W in it during a Seoul August will exceed PLA's glass transition and the bezel will bow. PLA
is only acceptable for an open, shaded, ventilated mount. This one choice determines whether
this is a two-summer project or a ten-year one.

---

## 6. Mounting

### 6.1 Position — decided by sightline

Your bed's head is against the top wall; the foot points at the bottom-wall bookshelf.

| Position | Verdict |
|---|---|
| Top wall, above the headboard | ❌ Behind and above you. You'd sit up and turn around to read it. Also washes the ceiling right where you look when trying to sleep. |
| **Bottom-wall bookshelf, on the bed's centreline** | ✅ **Correct.** Same logic as a TV at the foot of the bed. ~2.5–3 m viewing distance is ideal for 64×32 at 4 mm pitch. No ceiling spill. |
| Left wall near the door | ⚠️ Good for "check it on the way out", poor from bed. |

### 6.2 Mount to the carcass, not the flap door

Furniture mounting is strictly better than the wall here:

- **Zero drilling into concrete, zero wallpaper risk.** Critical if renting — Korean wallpaper
  delaminates before adhesive does, and takes paint with it.
- **Power supply and cable live inside the shelf.** No raceway, nothing visible on the wall.
- **Height is right.** ~1.2 m at ~2.5 m is ~16° up from a reclined position.

**But not on the moving flap door.** A push-to-open flap is the worst of both worlds:

| Problem | Detail |
|---|---|
| You'd push the display to open it | Force path: acrylic → grid → LED PCB. Cracks solder joints over time |
| ~700 g changes the door's balance | Aventos/Free-flap hardware is spec'd by weight × height; friction hinges have no adjustment at all and will sag |
| 25 mm of electronics protrude into the compartment | Books packed behind will crush them |
| Slam shock loosens friction-fit connectors | HUB75 IDC and the Portal's headers are the weak points |
| Cable flexes through the hinge forever | Solvable, but a failure mode you're volunteering for |

**Mount instead on:** the fixed rail above the flap, the apron below it, or recessed into a fixed
vertical face between compartments. You keep every benefit and lose every problem.

### 6.3 If the flap is genuinely the only place it fits

Three non-optional changes:

1. **Make the bezel structural and proud.** VHB the printed bezel to the door around its full
   perimeter, and let it stand ~1 mm above the acrylic. Fingers land on the bezel, load goes into
   the door, the panel carries nothing. Model a textured push-pad into the lower bezel so it
   reads as intentional.
2. **Recess it.** Route a 256 × 128 mm opening; panel from behind, front face flush with the
   door. Far better looking than surface-mounting, and cuts protrusion to ~20 mm. Add a plywood
   or printed reinforcement ring — removing that much area from thin MDF will let the door bow.
3. **Fix the balance first.** Weigh the door, check the hardware. Adjustable gas struts have a
   tension screw; fixed friction hinges need replacing or a counterweight. Sort this *before*
   cutting anything.

Cable through the hinge: silicone-jacket USB-C, service loop routed close to the hinge axis,
strain relief on both sides. At two cycles a day it outlasts the shelf.

### 6.4 Cleat geometry

French cleat, always. Two printed 30° bevels: one on the carcass, one on the rear shell. It
self-aligns, hangs dead flat, lifts off in one motion for service, and needs levelling exactly
once.

**Tilt:** build the downward angle into the cleat, not the mount.

| Mount height vs. eye level | Tilt |
|---|---|
| At or slightly above | 4° |
| ~40 cm above (typical shelf) | 8° |
| Above headboard height | 12–15° |

Total mass ≈ 700 g (panel 350 + frame/grid/acrylic 300 + electronics 50). Trivial load.

---

## 7. Power

### 7.1 Wall power, definitively

| Scenario | Draw | Runtime on a 10,000 mAh (37 Wh) pack |
|---|---|---|
| Full white, full brightness | ~3.5–4 A @ 5 V (~20 W) | 1.8 h |
| Typical content, 50% brightness | ~0.6–1.2 A (~4.5 W) | ~7 h |
| Night clock, 3% | ~0.15 A | ~45 h |

Even the best case means recharging a wall-mounted object daily. **Plug it in.**

### 7.2 Supply

The S3 has proper CC pulldowns, so any competent USB-C charger delivers 5 V at up to 3 A.
**Adafruit #4298** (RPi 5.1 V 3 A USB-C) is the pick — the extra 0.1 V compensates for cable
drop. Buy a KR/EU plug variant or a local 5 V/3 A charger.

**Discard the 2.4 A supply from the ADABOX.** It's marginal, and brownout is your single most
likely field failure.

### 7.3 The power governor — write this on day one

Before every frame is pushed to the panel:

```c
// Estimate current from the framebuffer, clamp brightness. Never brown out.
static float estimate_amps(const uint16_t *fb, size_t n) {
    uint32_t sum = 0;
    for (size_t i = 0; i < n; i++) {
        uint16_t p = fb[i];
        sum += ((p >> 11) & 0x1F) * 8       // R  → 0..248
             + ((p >>  5) & 0x3F) * 4       // G  → 0..252
             +  (p        & 0x1F) * 8;      // B  → 0..248
    }
    // K calibrated once with a USB power meter against a full-white frame
    return CAL_IDLE_A + (float)sum * CAL_K;
}

void apply_power_governor(uint16_t *fb, size_t n) {
    float a = estimate_amps(fb, n);
    if (a > BUDGET_A) {
        float scale = BUDGET_A / a;
        global_brightness = (uint8_t)(global_brightness * scale);
    }
}
```

Set `BUDGET_A = 2.5`. You now cannot brown out regardless of what card anyone writes. Calibrate
`CAL_K` once with a USB power meter and a full-white test pattern.

The compiler runs the same estimator statically on the worst-case frame of every card and warns
in the editor if a card would trigger the governor. That's rule P5 applied to electricity.

---

## 8. Firmware

**Stack:** ESP-IDF v5.x + Arduino-as-component (needed for HomeSpan). C99 for the renderer,
C++ for the glue.

### 8.1 Task layout — core affinity is not optional

| Core | Task | Priority | Notes |
|---|---|---|---|
| **0** | `matrix_refresh` | 24 (highest) | HUB75 bit-angle modulation. Pinned. Never yields to anything. |
| 0 | `renderer` | 10 | Walks the display list into the back buffer, swaps on vsync |
| **1** | `homespan` | 8 | HAP crypto + mDNS. **Must not touch core 0.** |
| 1 | `net_sync` | 6 | HTTPS long-poll, program/data fetch, heartbeat |
| 1 | `sensors` | 5 | I²C poll, UART parse, HX711 read |
| 1 | `ota` | 4 | Only alive during an update |

Getting HomeSpan onto core 0 produces visible tearing whenever the Home app polls. This is the
single most common way to ruin the display quality.

### 8.2 Memory map

| Region | Size | Contents |
|---|---|---|
| PSRAM | 2 MB | 2 × framebuffers (64×32×2 B = 4 KB each), display list (≤16 KB), asset cache (≤512 KB), font glyph cache |
| Flash — `factory` | 1 MB | Recovery image. Never overwritten. |
| Flash — `ota_0` / `ota_1` | 2 MB each | A/B firmware slots |
| Flash — `spiffs` | 2 MB | Asset bundle, last-good program, last-good data frame |
| NVS | 64 KB | Wi-Fi creds, device token, **HomeKit pairing**, calibration |

### 8.3 The renderer — `libmxr`

Plain C99, no `malloc` after init, no platform headers. This is the code that compiles to both
ESP32 and WASM.

```
libmxr/
├── mxr.h            # public API
├── vm.c             # bytecode interpreter (~900 LOC)
├── raster.c         # rect/line/blit/clip primitives (~400 LOC)
├── text.c           # bitmap font rasteriser + measure (~400 LOC)
├── fonts.c          # generated glyph tables
├── anim.c           # marquee, blink, fade, slide (~200 LOC)
└── gamma.c          # 8→12 bit LUT
```

```c
typedef struct {
    uint16_t *fb;              // 64*32 RGB565
    const uint8_t *program;    // bytecode
    const mxr_slot_t *slots;   // data frame
    const mxr_asset_t *assets;
    uint32_t t_ms;             // animation clock
} mxr_ctx_t;

int  mxr_render(mxr_ctx_t *ctx);
int  mxr_validate(const uint8_t *program, size_t len, mxr_diag_t *out);
void mxr_measure_text(uint8_t font, const char *s, int *w, int *h);
```

**Build targets:**

```bash
# Firmware
idf.py build

# WASM for the dashboard preview — same source, same fonts, same rounding
emcc libmxr/*.c -O3 \
  -sEXPORTED_FUNCTIONS='["_mxr_render","_mxr_validate","_mxr_measure_text","_malloc","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPU8","HEAPU16"]' \
  -sMODULARIZE -sENVIRONMENT=web \
  -o web/src/lib/mxr.js
```

The preview canvas and the panel now cannot disagree. Not "look similar" — cannot disagree.

### 8.4 Device sync protocol

No MQTT. Three endpoints, all HTTPS with a bearer token.

**Long-poll for changes** — the push channel:

```http
GET /device/wait?program=<etag>&data=<etag> HTTP/1.1
Authorization: Bearer <device-token>
```

Server holds up to 25 s. Returns `204 No Content` on timeout (device immediately reconnects), or
`200` with `{"program": true, "data": false}` the instant something changes. Sub-second push,
zero infrastructure.

**Fetch program:**

```http
GET /device/sync HTTP/1.1
If-None-Match: "<program-etag>"
→ 304 Not Modified   (the common case)
→ 200 { programVersion, bytecodeUrl, bytecodeSha256, assetBundleSha256, scenes[], rules[] }
```

**Heartbeat / telemetry** — every 60 s:

```http
POST /device/heartbeat
{
  "fw": "1.4.2", "programVersion": 87, "uptime": 918233,
  "rssi": -54, "heapFree": 184320, "psramFree": 1638400,
  "brightness": 42, "lux": 118.4,
  "tempC": 24.1, "humidity": 51.2,
  "presenceRoom": true, "presenceBed": false,
  "estAmps": 0.84, "governorActive": false,
  "lastError": null
}
```

Convex cron: no heartbeat in 90 s → mark offline, push a notification. That's your LWT.

**Backoff:** 1 s → 2 → 4 → 8 → 16 → 30 s cap, ±20% jitter. Hard reboot after 10 minutes of
continuous failure. Never hammer.

### 8.5 Offline behaviour (rule P4)

```
Boot
 └─ Load last-good program + data from SPIFFS  →  render immediately (<400 ms to first pixel)
 └─ Connect Wi-Fi in background
      ├─ Success  → sync, replace, clear stale flag
      └─ Failure  → keep rendering cached content
                    · data older than card's `stale after` → render dimmed (50% luma)
                    · 1 px at (63,0) at 20% → "not synced"
                    · NEVER show text, a QR, or a blank screen
```

If you unplug your router for a week, the panel shows a working clock and last week's weather
greyed out. That is the correct behaviour.

### 8.6 OTA

```
1. Server publishes a manifest, ed25519-signed:
   { version, url (R2), sha256, minVersion, signature }
2. Device verifies signature against a public key baked into `factory`.
3. Downloads to the inactive slot, verifies SHA-256.
4. esp_ota_set_boot_partition(inactive); reboot.
5. New image must call esp_ota_mark_app_valid_cancel_rollback() within 60 s.
6. If it doesn't (crash, no Wi-Fi, no server) → bootloader auto-reverts.
```

**Critical:** HomeKit pairing lives in NVS. Verify your partition table does not erase NVS on
OTA, or every firmware update un-pairs the accessory. Test this deliberately, twice.

Channels: `dev` (auto-update) and `stable` (manual promote). Run the panel on `stable`.

### 8.7 Provisioning

BLE, via the ESP-IDF Unified Provisioning stack.

1. Fresh device advertises `MXPANEL-XXXX`.
2. Your phone opens the dashboard's `/provision` page (Web Bluetooth).
3. Send SSID + password + device claim token.
4. Device connects, registers itself with Convex, pulls its first program.
5. Panel scrolls the 8-digit HomeKit setup code for pairing.

No captive portal, no serial console, no `secrets.py`.

### 8.8 Sensor handling

| Sensor | Poll | Processing |
|---|---|---|
| VEML7700 | 1 Hz | Exponential smoothing (α=0.05) + hysteresis band. Prevents headlight pumping. |
| SHT41 | 0.1 Hz | Median of 3 |
| LD2410C | 10 Hz UART | Debounce: 3 consecutive frames to assert, 30 s to clear |
| LD2450 | 10 Hz UART | Point-in-polygon against dashboard-defined zones |
| HX711 | 2 Hz | Tare on boot; threshold at 15 kg; 5 s debounce both ways |
| LIS3DH | interrupt | Double-tap → next card. Single tap ignored (too many false positives) |

**Auto-brightness curve** — perceptual, not linear:

```c
// lux 0.1 → 5%,  lux 10 → 20%,  lux 200 → 60%,  lux 1000+ → 100%
uint8_t brightness_from_lux(float lux) {
    float b = 5.0f + 95.0f * powf(fminf(lux, 1000.0f) / 1000.0f, 0.35f);
    return (uint8_t)fmaxf(NIGHT_FLOOR, fminf(b, homekit_ceiling));
}
```

`homekit_ceiling` is set by Siri/the Home app. **Ambient scales beneath the HomeKit value; it
never overrides it.** Otherwise you set 100% by voice, the lux sensor immediately walks it back
down, and it feels broken.

### 8.9 mmWave tuning

- **Gate the max distance** to just past the far edge of the bed. Untuned, 24 GHz goes straight
  through drywall and detects your neighbours. This bites everyone.
- Set per-gate static sensitivity individually. High for the bed/desk gates, zero beyond.
- **Do not trigger background recalibration from bed or on boot.** If the LD2410 re-learns the
  background while you're lying still, it absorbs you into it and goes blind.
- Expect false positives from curtains and bedsheets in aircon airflow. That's why the bed
  signal comes from the load cell, not the radar.

---

## 9. HomeKit integration

**Direction A: the panel is a native HomeKit accessory** via **HomeSpan** on the ESP32. It pairs
directly with the Home app — no Homebridge in the path, no plugin, no Pi dependency. If your
Homebridge host dies, the panel is unaffected.

Cost: ~50 KB RAM (trivial with 2 MB PSRAM) and core-1 pinning. No MFi chip means uncertified,
which is irrelevant for personal use.

### 9.1 Services exposed

| Service | Characteristics | Why it earns its place |
|---|---|---|
| **Lightbulb** | `On`, `Brightness` | Siri, the Home app slider, and automatic participation in "Good Night" scenes |
| **Occupancy Sensor** — Room | `OccupancyDetected` | From LD2410C. **The highest-value line here** — your bedroom presence becomes available to every automation in the house |
| **Occupancy Sensor** — Bed | `OccupancyDetected` | From the load cell. Trustworthy enough to build real automations on |
| **Temperature Sensor** | `CurrentTemperature` | SHT41. Free room sensor in the Home app |
| **Humidity Sensor** | `CurrentRelativeHumidity` | SHT41 |
| **Light Sensor** | `CurrentAmbientLightLevel` | VEML7700 — lets other automations react to room brightness |
| **Television** | `Active`, `ActiveIdentifier`, `ConfiguredName` | Abuse of the service, but each scene becomes an "input source" with a proper picker in the Home app *and* Control Center |
| **Stateless Switch** ×6 | `ProgrammableSwitchEvent` | "Hey Siri, show me the bus." Fires, pins a card for 60 s, self-clears |

The mmWave → `OccupancySensor` mapping is the sleeper feature. You bought the sensor for the
panel; exposing it turns it into whole-room presence for your entire smart home.

### 9.2 HomeSpan sketch

```cpp
#include "HomeSpan.h"

struct PanelLight : Service::LightBulb {
    SpanCharacteristic *power  = new Characteristic::On(true);
    SpanCharacteristic *bright = new Characteristic::Brightness(60);

    PanelLight() : Service::LightBulb() { bright->setRange(0, 100, 1); }

    boolean update() override {
        panel_set_power(power->getNewVal<bool>());
        // HomeKit sets the CEILING; the lux sensor scales beneath it
        panel_set_brightness_ceiling(bright->getNewVal<int>());
        return true;
    }
};

struct SceneTV : Service::Television {
    SpanCharacteristic *active = new Characteristic::Active(1);
    SpanCharacteristic *input  = new Characteristic::ActiveIdentifier(1);

    boolean update() override {
        if (input->updated()) scene_select(input->getNewVal<int>());
        if (active->updated()) panel_set_power(active->getNewVal<bool>());
        return true;
    }
};

void setup() {
    homeSpan.setControlPin(0);
    homeSpan.setStatusPin(LED_BUILTIN);
    homeSpan.setPairingCode(HOMEKIT_SETUP_CODE);
    homeSpan.begin(Category::Bridges, "Matrix Panel");

    new SpanAccessory();
      new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("Matrix Panel");
        new Characteristic::Manufacturer("Homebrew");
        new Characteristic::FirmwareRevision(FW_VERSION);
      new PanelLight();
      new SceneTV();

    new SpanAccessory();
      new Service::AccessoryInformation();
        new Characteristic::Identify();
        new Characteristic::Name("Bedroom Presence");
      new Service::OccupancySensor();

    new SpanAccessory();  // ... Bed Presence, Temperature, Humidity, Light
}
```

Run `homeSpan.poll()` from a task pinned to **core 1**.

### 9.3 Pairing UX

On first boot, scroll the 8-digit setup code across the panel for manual entry in the Home app.

A HomeKit QR needs ~37 × 37 modules plus a quiet zone — it will not fit in 32 rows. Print the QR
on a sticker for the back of the rear shell.

### 9.4 What this deletes from your build

**HomeKit automations replace part of your rules engine.** Once presence, brightness and scene
selection are HAP characteristics, the Home app handles:

- "When bedroom lights turn off after 22:00 → panel to night scene"
- "When bed occupancy becomes true → panel to 3%, lights off, aircon to sleep"
- "When I arrive home → panel on"

...with a real UI, on your phone, that you did not write and do not maintain.

**Keep server-side:** scheduling and data-driven rules (`bus.eta < 4 → pin card`), which HomeKit
cannot express. **Drop from your dashboard:** manual override UI, presence reaction logic, and
time-of-day on/off. The Home app's version is better than yours would have been.

### 9.5 Optional — Direction B, later

Showing *other* accessories' state on the panel. A HAP accessory can't query its peers, so this
goes through your Homebridge Config UI X REST API (`GET /api/accessories`) as a data source, or
via `hap-controller` on npm pairing your backend as a second controller.

Cards it unlocks: lights left on elsewhere, door lock state, aircon setpoint vs actual, washer
finished, filter life, other rooms' temperatures. **Defer to phase 2** — it's additive and
touches nothing in the core design.

### 9.6 Gotchas

- **Lock any plain-HTTP local endpoint** you expose alongside HAP with a shared secret. An
  unauthenticated `POST /brightness` on your LAN is a bad habit.
- **Don't reach for Matter.** ESP-IDF supports it and it'd add Google/Alexa, but it's heavier and
  fussier. You only want HomeKit; HomeSpan is the simpler, more mature path.
- **mDNS and Wi-Fi power save conflict.** Set `esp_wifi_set_ps(WIFI_PS_NONE)` — you're mains
  powered, and HAP responsiveness matters more than the 30 mA.

---

## 10. MXML — the card templating engine

**MXML** (Matrix Markup Language) is an HTML-shaped templating language. Files are `.card`.
It compiles to the bytecode in §11 and is rendered by `libmxr`, the shared C99 renderer (§8).

### 10.0 Design constraints

MXML targets **exactly one device: a single 64×32 HUB75 panel.** It is not a general UI language
and must never become one. Every simplification below follows from that:

| Constraint | Consequence |
|---|---|
| One fixed resolution | No responsive layout, no breakpoints, no percentages. All coordinates are integers 0–63 / 0–31. |
| One device | No capability negotiation, no per-device variants, no feature detection. |
| One canvas, no scrolling | No overflow model. Overflow is a **compile error**, not a runtime behaviour. |
| Bitmap fonts only | No font sizing, no line-height, no kerning, no text shaping. Four fonts, fixed metrics. |
| RGB565 output | Colours are 5/6/5. `#ffffff` and `#fefefe` are the same colour; the compiler says so. |
| Renders on a microcontroller | Expressions are **total** — no loops, no recursion, no user functions |

**The single-target assumption is a feature.** It lets the compiler resolve almost everything
statically and turn whole classes of runtime failure into editor squiggles.

### 10.1 Build it in three stages — this is the risk item

Everything else in this project is assembly work. MXML is *design* work, and design work is where
solo projects die: you can spend six weeks on grammar aesthetics with nothing on the wall.

**Ship the stages in order. Stop at whichever one stops hurting.**

| Stage | Adds | Lines | When |
|---|---|---|---|
| **0** | JSON layout. Absolute coords, `bind` to a source path, literal strings. No parser, no expressions, no layout engine. | ~200 | Week 2 |
| **1** | Real MXML parser. Expressions, filters, `<when>`, `<show>`, `<stale>`. Still absolute positioning. | ~900 | Week 3 |
| **2** | `row` / `col` / `pad` / `gap`, text measurement, `MEASURE` opcode, `<each>`. | ~1,400 | Week 5+ |

Stage 0 is deliberately tedious to hand-write. That tedium is your requirements document for
Stage 1. **The current cards in `cards/` ship on Stage 1** — that proves the whole pipeline
(compile → bytecode → device → render → preview matches) without a single line of grammar.

Most people build Stage 2 first, discover the layout engine is 80% of the work, and never ship a
card. Do not do that.

```json
// Stage 0 — the entire language, day 3
{ "id": "bus", "elements": [
  { "op": "text", "x": 20, "y": 2,  "font": "5x7", "color": "#ffffff", "bind": "bus.eta_min" },
  { "op": "text", "x": 44, "y": 2,  "font": "5x7", "color": "#ffffff", "value": "분" },
  { "op": "text", "x": 20, "y": 12, "font": "3x5", "color": "#666666", "bind": "bus.next_eta_min" }
]}
```

### 10.2 Full example (Stage 2)

```html
<card id="bus-402" name="Bus 402" priority="80">

  <source id="bus" kind="seoul.bus" arsId="23-005" route="402" every="20s" />

  <row pad="1" gap="2">
    <badge bg="#1a5fb4" fg="#ffffff" font="3x5">402</badge>

    <col gap="1">
      <text font="5x7" color="{{ bus.eta_min <= 3 ? '#ff4444' : '#ffffff' }}">
        {{ bus.eta_min }}분
      </text>
      <text font="3x5" color="#666666">{{ bus.next_eta_min | default('--') }}분</text>
    </col>

    <spacer />
    <bar w="4" h="24" value="{{ bus.crowding }}" max="3" color="#33cc66" />
  </row>

  <when test="{{ bus.eta_min <= 1 }}">
    <blink rate="600ms"><stroke color="#ff0000" /></blink>
  </when>

  <show  when="{{ weekday and now.hour >= 7 and now.hour < 10 }}" />
  <stale after="90s" style="dim" />
</card>
```

### 10.3 Element reference

Every element is either a **container**, a **drawable**, or a **directive**. Containers may nest;
drawables may not. `x`/`y` are optional inside a container (layout assigns them) and required
outside one.

#### Containers

| Element | Attributes | Notes |
|---|---|---|
| `<card>` | `id` `name` `priority` | Root. Exactly one per file. |
| `<row>` | `x` `y` `w` `h` `pad` `gap` `align` | Horizontal flow. `align` = `top`\|`middle`\|`bottom` |
| `<col>` | `x` `y` `w` `h` `pad` `gap` `align` | Vertical flow. `align` = `left`\|`center`\|`right` |
| `<box>` | `x` `y` `w` `h` `pad` `bg` `border` | Absolute container; clips its children |
| `<spacer>` | `size` | Flexible gap inside row/col. No `size` = absorb remaining space |

#### Drawables

| Element | Attributes | Emits |
|---|---|---|
| `<text>` | `x` `y` `font` `color` `align` | `TEXT` |
| `<marquee>` | `x` `y` `w` `font` `color` `speed` `gap` | `MARQUEE` — scrolls only if it overflows `w` |
| `<icon>` | `x` `y` `src` `color` | `BLIT` / `BLIT_TINT` |
| `<sprite>` | `x` `y` `src` `frame` | `BLIT` |
| `<badge>` | `bg` `fg` `font` `pad` `radius` | `FRECT` + `TEXT` |
| `<rect>` | `x` `y` `w` `h` `color` | `FRECT` |
| `<stroke>` | `x` `y` `w` `h` `color` | `RECT` — defaults to the full 64×32 |
| `<line>` | `x1` `y1` `x2` `y2` `color` | `LINE` |
| `<pixel>` | `x` `y` `color` | `PIXEL` |
| `<bar>` | `x` `y` `w` `h` `value` `max` `color` `bg` `dir` | `FRECT` ×2. `dir` = `up`\|`right` |
| `<progress>` | `x` `y` `w` `value` `max` `color` | Thin `<bar>` |
| `<sparkline>` | `x` `y` `w` `h` `values` `color` `min` `max` | `LINE` run |
| `<gauge>` | `x` `y` `r` `value` `max` `color` | Arc |
| `<grid>` | `x` `y` `cols` `rows` `cell` `values` `scale` | Dot matrix — habit streaks, contribution grids |

#### Directives

| Element | Attributes | Semantics |
|---|---|---|
| `<source>` | `id` `kind` `every` + plugin-specific | Declares a data dependency. Compile-time only. |
| `<when>` | `test` | Conditional subtree → `JMPZ` |
| `<show>` | `when` | Card-level visibility. Zero or one per card. |
| `<each>` | `in` `as` `limit` | Bounded iteration. `limit` is **mandatory** (see §10.9). |
| `<stale>` | `after` `style` | `dim` \| `hide` \| `strike`. Card-level. |
| `<blink>` | `rate` | Wraps a subtree → `ANIM` |
| `<def>` | `name` `value` | Compile-time constant. No runtime cost. |

### 10.4 Attribute value forms

```
color="#ff0000"                     literal
color="{{ expr }}"                  full-value binding
text ...>{{ a }}분 {{ b }}</text>   interpolation inside content
x="20"                              integer literal
every="20s"  rate="600ms"           duration: ms | s | m | h
after="90s"
```

Colours accept `#rgb`, `#rrggbb`, and the 16 named CSS basics. The compiler warns when two
literals in the same card collapse to the same RGB565 value.

### 10.5 Expression grammar

```ebnf
expr     ::= ternary
ternary  ::= or ( "?" expr ":" expr )?
or       ::= and ( "or" and )*
and      ::= not ( "and" not )*
not      ::= "not"? cmp
cmp      ::= add ( ("=="|"!="|"<"|"<="|">"|">=") add )?
add      ::= mul ( ("+"|"-") mul )*
mul      ::= unary ( ("*"|"/"|"%") unary )*
unary    ::= "-"? postfix
postfix  ::= primary ( "|" filter )*
filter   ::= IDENT ( "(" args ")" )?
primary  ::= NUMBER | STRING | BOOL | "null" | path | "(" expr ")"
path     ::= IDENT ( "." IDENT )*
```

**No loops. No assignment. No function definitions. No indexing by a computed value.**

This is not minimalism for its own sake. Totality means the compiler can *prove* every card
terminates, so **a malformed card cannot hang the panel.** That guarantee is what lets you edit
cards from your phone at 1 AM without fear. Give it up and you need on-device timeouts,
sandboxing, and a watchdog recovery story.

#### Ambient scope

Always available, no `<source>` needed:

| Path | Type |
|---|---|
| `now.hour` `now.minute` `now.second` `now.dow` `now.day` `now.month` `now.year` | int |
| `now.ts` | unix seconds |
| `weekday` `weekend` | bool |
| `device.lux` `device.brightness` `device.rssi` `device.uptime_s` | int |
| `device.presence` `device.bed_occupied` `device.online` | bool |
| `room.temp_c` `room.humidity` | float |
| `scene` | string |

### 10.6 Filters

| Filter | Signature | Notes |
|---|---|---|
| `round` `floor` `ceil` `abs` | num → num | |
| `pad(n)` | num → str | Zero-pad |
| `comma` | num → str | 1234 → "1,234" |
| `fixed(n)` | num → str | Decimal places |
| `upper` `lower` | str → str | ASCII only |
| `trunc(n)` | str → str | Adds `…` when cut |
| `default(v)` | any → any | **Use this everywhere.** Null-safety in one token. |
| `relative` | ts → str | "3분 전" |
| `duration` | sec → str | "1h 24m" |
| `hhmm` `hhmmss` `date` | ts → str | |
| `color_scale(a,b,c)` | num → color | Interpolate across stops |
| `map(a,b,c,d)` | num → num | Linear remap |
| `clamp(lo,hi)` | num → num | |
| `icon_for` | str → asset | Condition code → icon id |

Filters are pure, total, and implemented **once** in C99 so the WASM preview and the device
produce identical output. Adding a filter means touching one file.

### 10.7 Data binding and the slot mechanism

**Slots are the load-bearing idea of the whole system.**

Every dynamic value in a card compiles to a **slot** — a `u8` index into a data frame.
`{{ bus.eta_min }}` becomes slot 7. The bytecode references slot 7. Slot 7's *value* arrives
separately as ~150 bytes of CBOR.

```
   compile time                    runtime
   ────────────                    ───────
   {{ bus.eta_min }}  ──►  slot 7  ──►  {7: 4}   every 20s, ~150 B
                                        {7: 3}
                                        {7: 2}
```

Consequences, all of which matter:

- **The program never recompiles when data changes.** Deploys are rare; data is constant.
- **Bandwidth is trivial.** A bus ETA ticking down all morning costs a few KB.
- **Offline works by construction.** The device holds the last program *and* the last frame in
  flash. WiFi dies → it keeps rendering this morning's data with the stale indicator lit.
- **Preview is exact.** Feed the same slot frame to the WASM renderer and you get the same pixels.

Slot types: `int` (i32) · `float` · `str` (interned) · `color` (u16) · `bool` · `null`.
Max 255 slots per program — you will not approach this.

### 10.8 Types come from Zod, not from MXML

MXML has no type declarations. Every source plugin exports a Zod schema, and the compiler
type-checks paths against it:

```ts
// sources/seoul.bus.ts
export const schema = z.object({
  eta_min:      z.number().int().nullable(),
  next_eta_min: z.number().int().nullable(),
  crowding:     z.number().int().min(0).max(3),
  route:        z.string(),
  plate:        z.string().optional(),
});
```

```
{{ bus.eta_mins }}
        ~~~~~~~~  unknown field on source 'bus' (kind: seoul.bus)
                  did you mean 'eta_min'?
```

**This is most of the felt reliability of the entire system, and it's nearly free once sources
are typed.** A typo becomes a red squiggle in the editor rather than a blank pixel at 7 AM.

Nullable fields are enforced: using a nullable value without `| default(...)` or a `<when>` guard
is a compile **error**, not a warning. The renderer has no null.

### 10.9 What is deliberately excluded

| Excluded | Why |
|---|---|
| Loops, recursion, user functions | Totality. A card must not be able to hang the panel. |
| CSS, classes, cascade, inheritance | 64×32. Style locality beats reuse at this size. |
| Percentages, `auto`, flex-grow ratios | One fixed resolution. Integers only. |
| Unbounded `<each>` | `limit` is mandatory so worst-case layout is statically knowable. |
| Nested `<each>` | Rejected outright. |
| Network access from a card | Data comes from `<source>` only. Cards are pure. |
| Custom fonts at runtime | Four bitmap fonts, baked into the asset bundle. |
| `<fade>` `<slide>` `<pulse>` `<typewriter>` | **Cut.** Ship `<blink>` alone; add others only when a card you actually want is impossible without one. The `ANIM` opcode stays general — the *syntax* shouldn't be. |

**`<each>` is on probation.** It needs a loop counter, per-item slot allocation, and dynamic
layout, and it exists to serve maybe three cards (multi-route bus board, agenda list,
lights-per-room dots). Try three hardcoded rows with `<when>` guards first. It's uglier and it
may be enough forever. Build it in Stage 2 only if hand-unrolling has actually annoyed you.

### 10.10 Compiler pipeline

Lives in `compiler/`, a TS workspace package imported unchanged by the browser, by Convex, and by
CI.

| Pass | Does | Fails with |
|---|---|---|
| **1. Lex + parse** | Recursive descent → AST with byte-exact source spans | Syntax error at line:col |
| **2. Resolve** | Bind paths to `<source>` schemas and ambient scope | Unknown source / unknown field / did-you-mean |
| **3. Typecheck** | Zod schema → expression types; null-safety | Type mismatch, unguarded nullable |
| **4. Layout** | Resolve `row`/`col`/`pad`/`gap` to absolute coords using real font metrics | Overflow past 64×32 |
| **5. Validate** | Bounds, asset existence, glyph coverage, slot count, duplicate ids | Missing icon, missing Hangul glyph |
| **6. Optimise** | Constant-fold, dead-branch elim, merge adjacent fills, intern strings, dedupe colours | — |
| **7. Emit** | Bytecode + slot map + asset refs; SHA-256 → program version | — |

**Layout is the expensive pass.** Static text is measured at compile time from the font metrics
table. Dynamic text can't be, so the compiler either reserves worst-case width (when the schema
bounds it — `eta_min` is 0–999, so 3 glyphs) or emits a `MEASURE` opcode for the device to
resolve. Prefer bounded schemas; they produce tighter, cheaper layouts.

### 10.11 Diagnostics

Every error carries a span, and the preview renders the failure visually:

```
bus-402.card:8:24  error  unguarded nullable

    8 │   <text font="5x7">{{ bus.next_eta_min }}분</text>
      │                       ^^^^^^^^^^^^^^^^
      │  'next_eta_min' is number|null on source 'bus'.
      │  Add `| default('--')` or wrap in <when test="...">.
```

```
bus-402.card:5:3   error  overflow

    row is 68px wide; canvas is 64px.
    Overflowing child: <badge> at x=52 (16px wide).
    [preview shows the overflowing element outlined in red]
```

**A card that does not compile cannot be deployed.** There is no runtime parse path on the
device — the device only ever receives validated bytecode.

### 10.12 Fonts and glyph coverage

| Name | Metrics | Use |
|---|---|---|
| `3x5` (tom-thumb) | 3×5, 1px advance | Dense labels, secondary values |
| `5x7` (spleen) | 5×7 | Body — the default |
| `8x16` (spleen) | 8×16 | Big numbers |
| `seg7` | 12×20 | Night clock only |

**Hangul is the hard part.** 한글 is illegible below ~11px, so it does not exist in the ASCII
fonts. Instead:

1. Pass 5 extracts every Hangul syllable appearing in string literals across all cards
2. Those syllables (~200–400 in practice) are rendered at 11×11 into the asset bundle
3. `<text>` transparently blits them, mixing 5×7 Latin and 11×11 Hangul on one baseline

Using a Hangul syllable inside a *dynamic* string the compiler can't see is a **build error** —
declare it via `<def>` or add it to the card's `glyphs="..."` attribute. Otherwise you'd get a
missing-glyph box on the wall at 7 AM.

### 10.13 Editor and simulate panel

The grammar is not what makes MXML pleasant to use. These two things are:

**Byte-identical preview.** `libmxr` compiled to WASM renders in the browser using the same
rasteriser, the same rounding, the same gamma LUT as the panel. Not "similar" — identical. The
entire category of *"why does it look different on the device"* cannot occur.

**The simulate panel.** Override any source value and watch the card render:

```
bus.eta_min      [ 0 ]  ← test the red state
bus.next_eta_min [null]  ← test null-safety
air.pm25         [200 ]  ← test the interrupt
weather          [null]  ← test source-down
device.lux       [ 2  ]  ← test night dimming
now.hour         [ 7  ]  ← test <show when>
```

Plus a time scrubber for animation, a slot inspector on hover, and a "snapshot" button that adds
the current render to the CI baseline (§17).

**Given a fixed budget, an hour spent on the simulate panel beats an hour spent on syntax, every
time.** Every edge case you'd otherwise discover standing at a bus stop, you see in the editor.

### 10.14 Assets

Icons and sprites live in a content-addressed bundle in LittleFS. The dashboard ships an icon
library plus a built-in pixel editor. Changing an icon changes the bundle hash; the device pulls
only the delta on its next `/d/program` check.

---
## 11. Bytecode specification

Little-endian, variable-length. Programs are typically 300 B – 4 KB.

### 11.1 Header

```
offset  size  field
0       4     magic  "MXR1"
4       2     version
6       2     flags       bit0 = has_animation, bit1 = has_measure
8       1     slot_count
9       1     asset_count
10      2     string_table_offset
12      2     code_offset
14      2     code_length
16      4     crc32 (of everything after the header)
20      64    ed25519 signature
```

### 11.2 Opcodes

| Op | Name | Operands | Notes |
|---|---|---|---|
| `0x01` | `CLEAR` | `color:u16` | |
| `0x10` | `FRECT` | `x,y,w,h:u8` `color:u16` | Filled |
| `0x11` | `RECT` | `x,y,w,h:u8` `color:u16` | Outline |
| `0x12` | `LINE` | `x1,y1,x2,y2:u8` `color:u16` | Bresenham |
| `0x13` | `PIXEL` | `x,y:u8` `color:u16` | |
| `0x14` | `GRADV` | `x,y,w,h:u8` `c1,c2:u16` | Vertical gradient |
| `0x20` | `TEXT` | `x,y:u8` `font:u8` `color:u16` `src:u8` | `src` high bit: 0=string table, 1=slot |
| `0x21` | `MARQUEE` | `x,y,w:u8` `font:u8` `color:u16` `speed:u8` `src:u8` | Scroll state in VM |
| `0x22` | `DIGITS` | `x,y:u8` `font:u8` `color:u16` `slot:u8` `pad:u8` | Tabular, no jitter |
| `0x23` | `MEASURE` | `slot:u8` `font:u8` `→out:u8` | Runtime text width → scratch slot |
| `0x30` | `BLIT` | `x,y:u8` `asset:u16` | |
| `0x31` | `BLITC` | `x,y:u8` `asset:u16` `tint:u16` | Tinted (1-bit icons) |
| `0x32` | `SPRITE` | `x,y:u8` `asset:u16` `fps:u8` | Animated |
| `0x40` | `JMP` | `→target:u16` | |
| `0x41` | `JMPZ` | `slot:u8` `→target:u16` | Jump if slot falsy |
| `0x42` | `JMPCMP` | `slot:u8` `op:u8` `imm:i32` `→target:u16` | `op`: eq/ne/lt/le/gt/ge |
| `0x43` | `JMPSTALE` | `slot:u8` `ms:u16` `→target:u16` | Jump if slot older than `ms` |
| `0x50` | `PUSHCLIP` | `x,y,w,h:u8` | Max depth 4 |
| `0x51` | `POPCLIP` | | |
| `0x52` | `PUSHDIM` | `pct:u8` | Multiplies subsequent colours — powers `<stale style="dim">` |
| `0x53` | `POPDIM` | | |
| `0x60` | `BLINK` | `rate:u16` `duty:u8` `→end:u16` | Skips block on off-phase |
| `0x61` | `FADE` | `from,to:u8` `dur:u16` `→end:u16` | |
| `0x62` | `SLIDE` | `dir:u8` `dur:u16` `dx,dy:i8` `→end:u16` | |
| `0xFE` | `NOP` | | Patch space |
| `0xFF` | `HALT` | | |

### 11.3 Slot frame (CBOR)

```jsonc
{
  "v": 412,                       // dataVersion
  "t": 1753340000,                // server unix seconds
  "s": {
    "0": 4,                       // bus.eta_min
    "1": 12,                      // bus.next_eta_min
    "2": 2,                       // bus.crowding
    "3": "402번 강남역 방면",       // interned string
    "4": 23.8                     // indoor temp
  },
  "a": { "0": 1753339980 }        // per-slot last-updated, for JMPSTALE
}
```

### 11.4 VM guarantees

- **No allocation.** All scratch is a fixed 256 B stack in the context struct.
- **Bounded execution.** Backward jumps are rejected at validate time. Every program terminates.
- **Bounded draw calls.** `mxr_validate` counts ops; >2048 is rejected.
- **Clip-safe.** All primitives clip against the current rect. Out-of-bounds coords are
  impossible to express, not merely handled.
- **Signature-checked** before the first byte executes.

A malformed or hostile program cannot crash, hang, or brown out the panel. That's what makes it
safe to expose bytecode authoring to a web UI.

---

## 12. Backend — Convex

Convex replaces the API server, the job queue, the workers, the cache, the WebSocket layer and
the blob store. What's left is schema and functions.

| What you'd have built | Convex primitive |
|---|---|
| Hono routes + handlers | `query` / `mutation`, typed end-to-end |
| BullMQ + Redis + worker dynos | `crons` + `scheduler.runAfter` |
| Source-fetch workers | `action` (can `fetch()` external APIs) |
| Dashboard live state (WS) | reactive `useQuery` — free |
| Device endpoints | `httpAction` |
| S3 for bytecode/assets | `ctx.storage` |
| Transaction discipline | mutations are ACID by construction |

### 12.1 Schema

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  devices: defineTable({
    name: v.string(),
    tokenHash: v.string(),
    programVersion: v.number(),
    programEtag: v.string(),
    dataVersion: v.number(),
    dataEtag: v.string(),
    activeSceneId: v.optional(v.id("scenes")),
    pinnedCardId: v.optional(v.id("cards")),
    pinnedUntil: v.optional(v.number()),
    fwVersion: v.string(),
    fwChannel: v.union(v.literal("dev"), v.literal("stable")),
    online: v.boolean(),
    lastSeen: v.number(),
  }).index("by_token", ["tokenHash"]),

  cards: defineTable({
    slug: v.string(),
    name: v.string(),
    source: v.string(),               // the .card text
    compiledStorageId: v.optional(v.id("_storage")),
    slotMap: v.array(v.object({
      index: v.number(), path: v.string(),
      type: v.string(), sourceId: v.string(),
    })),
    sourceRefs: v.array(v.string()),
    diagnostics: v.array(v.object({
      severity: v.string(), message: v.string(),
      line: v.number(), col: v.number(),
    })),
    estimatedAmps: v.number(),
    enabled: v.boolean(),
    priority: v.number(),
    dwellMs: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  cardVersions: defineTable({          // every deploy, for one-click rollback
    cardId: v.id("cards"),
    version: v.number(),
    source: v.string(),
    compiledStorageId: v.id("_storage"),
    deployedAt: v.number(),
  }).index("by_card", ["cardId", "version"]),

  scenes: defineTable({
    name: v.string(),
    cardIds: v.array(v.id("cards")),
    schedule: v.optional(v.string()),  // "weekday 06:30-09:30"
    brightnessCeiling: v.optional(v.number()),
    homekitIdentifier: v.number(),     // Television input source id
    enabled: v.boolean(),
  }),

  rules: defineTable({
    name: v.string(),
    condition: v.string(),             // same expression grammar as the DSL
    action: v.object({
      kind: v.string(),                // pin | interrupt | scene | brightness | sleep
      cardId: v.optional(v.id("cards")),
      sceneId: v.optional(v.id("scenes")),
      durationMs: v.optional(v.number()),
      value: v.optional(v.number()),
    }),
    priority: v.number(),
    enabled: v.boolean(),
  }),

  sources: defineTable({
    sourceId: v.string(),              // "bus", "wx", "air"
    kind: v.string(),                  // "seoul.bus", "kma.now"
    config: v.any(),
    intervalMs: v.number(),
    origin: v.union(v.literal("convex"), v.literal("fly-nrt")),
    data: v.any(),
    fetchedAt: v.number(),
    error: v.optional(v.string()),
    consecutiveFailures: v.number(),
    circuitOpenUntil: v.optional(v.number()),
  }).index("by_sourceId", ["sourceId"]),

  telemetry: defineTable({             // rolling 24h; cron prunes
    deviceId: v.id("devices"),
    at: v.number(),
    rssi: v.number(), heapFree: v.number(),
    brightness: v.number(), lux: v.number(),
    tempC: v.number(), humidity: v.number(),
    presenceRoom: v.boolean(), presenceBed: v.boolean(),
    estAmps: v.number(), governorActive: v.boolean(),
    lastError: v.optional(v.string()),
  }).index("by_device_time", ["deviceId", "at"]),

  firmware: defineTable({
    version: v.string(),
    channel: v.string(),
    r2Url: v.string(),
    sha256: v.string(),
    signature: v.string(),
    releasedAt: v.number(),
  }).index("by_channel", ["channel", "releasedAt"]),
});
```

### 12.2 Device HTTP actions

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// ── Long-poll push channel ───────────────────────────────────────────────
http.route({
  path: "/device/wait",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const device = await authDevice(ctx, req);
    const url = new URL(req.url);
    const pEtag = url.searchParams.get("program");
    const dEtag = url.searchParams.get("data");

    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      const d = await ctx.runQuery(internal.devices.get, { id: device._id });
      if (d.programEtag !== pEtag || d.dataEtag !== dEtag) {
        return Response.json({
          program: d.programEtag !== pEtag,
          data:    d.dataEtag   !== dEtag,
        });
      }
      await sleep(750);
    }
    return new Response(null, { status: 204 });   // device reconnects immediately
  }),
});

// ── Program fetch ────────────────────────────────────────────────────────
http.route({
  path: "/device/sync",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const device = await authDevice(ctx, req);
    const manifest = await ctx.runQuery(internal.programs.manifest, {
      deviceId: device._id,
    });
    if (req.headers.get("If-None-Match") === manifest.etag) {
      return new Response(null, { status: 304 });
    }
    return Response.json(manifest, {
      headers: { ETag: manifest.etag, "Cache-Control": "no-cache" },
    });
  }),
});

// ── Slot frame fetch ─────────────────────────────────────────────────────
http.route({ path: "/device/data", method: "GET", handler: /* CBOR slot frame */ });

// ── Heartbeat ────────────────────────────────────────────────────────────
http.route({
  path: "/device/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const device = await authDevice(ctx, req);
    await ctx.runMutation(internal.telemetry.record, {
      deviceId: device._id, ...(await req.json()),
    });
    return new Response(null, { status: 204 });
  }),
});

// ── Local control mirror (for phone Shortcuts, not the device) ───────────
http.route({ path: "/api/pin",   method: "POST", handler: /* pin card N seconds */ });
http.route({ path: "/api/scene", method: "POST", handler: /* switch scene */ });
http.route({ path: "/api/poke",  method: "POST", handler: /* takeover message */ });

export default http;
```

### 12.3 Crons

```ts
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Global sources fetched from Convex directly
crons.interval("spotify",  { seconds: 15 },  internal.sources.fetchOne, { id: "spotify" });
crons.interval("calendar", { minutes: 5 },   internal.sources.fetchOne, { id: "calendar" });
crons.interval("github",   { minutes: 10 },  internal.sources.fetchOne, { id: "github" });
crons.interval("fx",       { minutes: 30 },  internal.sources.fetchOne, { id: "fx" });

// Housekeeping
crons.interval("offline-check", { seconds: 30 }, internal.devices.markStale);
crons.interval("rules",         { seconds: 10 }, internal.rules.evaluate);
crons.interval("scene-sched",   { minutes: 1 },  internal.scenes.applySchedule);
crons.daily("prune-telemetry",  { hourUTC: 18, minuteUTC: 0 }, internal.telemetry.prune);

export default crons;
```

Note that Korean sources are **absent** — they're driven from the Oracle ICN fetcher (§13).

### 12.4 Source plugin interface

```ts
export interface SourcePlugin<C, D> {
  kind: string;
  configSchema: z.ZodType<C>;
  dataSchema: z.ZodType<D>;          // ← what the DSL type-checks against
  defaultIntervalMs: number;
  origin: "convex" | "fly-nrt";
  timeoutMs: number;
  fetch(config: C): Promise<D>;
}
```

`dataSchema` is the contract. It's what makes `{{ bus.eta_min }}` a compile-time-checked
expression instead of a runtime `undefined`.

**Resilience per source:** hard timeout, circuit breaker (5 consecutive failures → open for
5 min), stale-while-revalidate. A dead upstream dims one number. It never takes down the panel.

### 12.5 Compile & deploy

```ts
// convex/programs.ts
export const compileAndDeploy = mutation({
  args: { cardIds: v.array(v.id("cards")), deviceId: v.id("devices") },
  handler: async (ctx, { cardIds, deviceId }) => {
    const cards = await Promise.all(cardIds.map(id => ctx.db.get(id)));
    const sources = await ctx.db.query("sources").collect();

    // Same compiler package the browser runs. Identical output, by construction.
    const result = compile(cards, sources);
    if (result.diagnostics.some(d => d.severity === "error")) {
      throw new ConvexError({ code: "COMPILE_FAILED", diagnostics: result.diagnostics });
    }

    const storageId = await ctx.storage.store(new Blob([result.bytecode]));
    const etag = sha256(result.bytecode);

    const device = await ctx.db.get(deviceId);
    await ctx.db.patch(deviceId, {
      programVersion: device.programVersion + 1,
      programEtag: etag,
    });
    // → the device's open long-poll returns within ~750 ms
    return { etag, size: result.bytecode.length, warnings: result.diagnostics };
  },
});
```

### 12.6 Auth

- **Humans:** Convex Auth with **passkeys**. It's your own bedroom — make login pleasant.
- **Device:** a 256-bit bearer token, generated at provisioning, stored hashed. Rotate by
  re-provisioning. There's exactly one device; don't over-engineer this.

---

## 13. The Seoul fetcher — Oracle Cloud (ICN)

### 13.1 Why it exists

`data.go.kr`, KMA, AirKorea and TOPIS are Korean government infrastructure: slow, occasionally
rate-limited by origin, sometimes with TLS chains that misbehave from foreign IPs, and prone to
unannounced maintenance. They're also your **highest-frequency** outbound calls — the bus source
alone is every 20 s.

Convex Cloud is US-hosted. Polling Seoul from Virginia every 20 s means a Korea → US → Korea
round trip on your most latency-sensitive and least reliable dependency.

**Oracle Cloud Always Free has an ICN (Seoul) region** — in-country, single-digit milliseconds
to the government endpoints, on Korean network paths, for free. That beats Fly `nrt` (Tokyo,
~35 ms) and Railway (Singapore, ~75 ms) on every axis including cost. Use it.

### 13.1a What stays on Convex, and why

The dividing line is **state**:

| | Runs on | Reasoning |
|---|---|---|
| Cards, programs, scenes, rules, telemetry, blobs, device sync | **Convex Cloud** | Someone else is accountable for durability |
| Korean API polling, Tailscale node, CI runner, uptime monitor | **Oracle ICN** | Stateless — losing the box costs you 10 minutes |

Oracle Always Free is excellent infrastructure with an asterisk: instances can be reclaimed
(§13.5), A1 capacity is often unavailable, and free-tier account terminations are a known
complaint. **That risk is fine for stateless workloads and unacceptable for your only copy of
everything.** If Oracle reclaims the box, the Korean cards go stale for as long as it takes you
to redeploy a container; nothing is lost. Had Postgres and every card definition been on it,
that's a genuinely bad day.

Put stateless things on free infrastructure you don't fully trust. Put stateful things where
durability is somebody's contractual problem.

### 13.2 What it is

A single ~150-line always-on Node process. Stateless. No database, no volume, no ingress.

```ts
// fetcher/src/index.ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

const KOREAN_SOURCES = [
  { id: "bus",     kind: "seoul.bus",    interval: 20_000 },
  { id: "subway",  kind: "seoul.subway", interval: 30_000 },
  { id: "wx",      kind: "kma.now",      interval: 600_000 },
  { id: "wx-fcst", kind: "kma.forecast", interval: 1_800_000 },
  { id: "rain",    kind: "kma.nowcast",  interval: 300_000 },
  { id: "air",     kind: "airkorea",     interval: 600_000 },
  { id: "quake",   kind: "kma.quake",    interval: 60_000 },
  { id: "bike",    kind: "seoul.bike",   interval: 120_000 },
];

for (const s of KOREAN_SOURCES) {
  const tick = async () => {
    try {
      const data = await withTimeout(plugins[s.kind].fetch(configFor(s.id)), 8_000);
      await convex.mutation(api.sources.write, { sourceId: s.id, data });
    } catch (err) {
      await convex.mutation(api.sources.writeError, {
        sourceId: s.id, error: String(err),
      });
    } finally {
      setTimeout(tick, s.interval + jitter(0.1));
    }
  };
  tick();
}
```

### 13.3 Deployment

One `VM.Standard.A1.Flex` instance in **ICN (Seoul)**, Ubuntu 24.04 ARM64. Provision **1 OCPU /
6 GB**, not the full 4/24 — see §13.5.

```yaml
# /opt/matrix/docker-compose.yml
services:
  fetcher:
    build: .
    restart: always
    environment:
      - CONVEX_URL=${CONVEX_URL}
      - CONVEX_SERVICE_TOKEN=${CONVEX_SERVICE_TOKEN}
      - DATA_GO_KR_KEY=${DATA_GO_KR_KEY}
      - KMA_KEY=${KMA_KEY}
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  tailscale:                        # §13.4
    image: tailscale/tailscale
    restart: always
    environment: [TS_AUTHKEY=${TS_AUTHKEY}, TS_STATE_DIR=/var/lib/tailscale]
    volumes: [tailscale-state:/var/lib/tailscale]
    cap_add: [NET_ADMIN, SYS_MODULE]

  uptime-kuma:                      # monitoring, deliberately off-Convex
    image: louislam/uptime-kuma:1
    restart: always
    ports: ["127.0.0.1:3001:3001"]
    volumes: [kuma-data:/app/data]

volumes: { tailscale-state:, kuma-data: }
```

Lock the security list down to SSH only — the fetcher takes **no inbound traffic**. Enable
`unattended-upgrades`. Everything on the box is `docker-compose.yml` + `.env` in a private repo,
so a full rebuild after a reclamation is one `git clone` and one `docker compose up -d`.

### 13.4 What else the free tier unlocks

You have 4 ARM cores and 24 GB sitting in Seoul. Three of these are genuinely worth doing:

| Workload | Why |
|---|---|
| **Tailscale node** | Solves §9.3. Your backend needs to reach Homebridge on your home LAN to pull HomeKit state into cards. Join the Oracle box to your tailnet and it queries `homebridge.local` directly — **no port forwarding, no exposing Homebridge to the internet.** This is the biggest unlock. |
| **Self-hosted CI runner** | ESP-IDF builds are slow on GitHub Actions' free tier. A 4-core ARM64 runner cuts firmware build time substantially, and ARM64 is native for the toolchain. |
| **Uptime Kuma** | §17 requires monitoring to live on a *different* host than the thing being monitored. This is that host. Watches Convex, the dashboard, and the device's last-seen timestamp. |

Do **not** move Homebridge here — HAP and mDNS need to be on the same LAN as your accessories.

### 13.5 Idle reclamation — read this before you deploy

Oracle's docs state that Always Free compute may be reclaimed if, over a 7-day window, CPU
utilisation at the 95th percentile is under 20% (network and memory thresholds also apply, and
the exact numbers have shifted over time — check the current Always Free Resources page).

**A fetcher making an HTTP call every 20 seconds will not come close to 20% of four ARM cores.
You will look idle and you will get reclaimed.** Three fixes, best first:

1. **Upgrade to Pay As You Go.** Always Free resources remain free on a PAYG account, but PAYG
   accounts aren't subject to idle reclamation. You'll need a card on file; if you provision
   nothing beyond the Always Free allowance, the bill stays at zero. This is the real fix.
2. **Provision 1 OCPU, not 4.** The threshold is a *percentage*. Your workload is 20× more
   likely to clear 20% of one core than of four. Free either way.
3. **Give it real work.** The CI runner in §13.4 burns legitimate CPU on every firmware commit.

Do not use a CPU-burning cron to fake activity — it's against the spirit of the terms and it's
the kind of thing that gets accounts terminated.

**Also expect "Out of host capacity" when provisioning A1 in ICN.** It's a popular region and
capacity is frequently exhausted. Save the instance config as a Terraform stack and re-apply on
a loop from Cloud Shell rather than clicking Create by hand; it can take days.

### 13.6 Failure isolation

If the Oracle box dies entirely, the Korean sources go stale. Convex still serves the last-known
slot values, the device still renders, and the affected numbers grey out per each card's
`<stale after="...">`. Weather and bus dim; the clock, HomeKit control, and every global source
keep working. Exactly the graceful degradation P4 asks for.

Set an Uptime Kuma → push notification on the fetcher's heartbeat mutation so you find out from
your phone, not from a stale bus card at 7 AM.

---

## 14. Dashboard — SvelteKit

### 14.1 Why SvelteKit over Next.js

This app is ~95% client: a code editor with a custom language mode, a WASM canvas re-rendering
on every keystroke, drag-to-position, live device state.

- **Runes are exactly right for this.** `$state` for the source text, `$derived` for the AST and
  bytecode, `$effect` to push into WASM. The live-preview pipeline is ~15 lines and it's
  fine-grained by construction — no memoisation ritual, no re-render-the-tree.
- **RSC provides approximately zero value here** and imposes a permanent "server or client
  component?" tax on a workload with no server rendering to do.
- **Bundle size.** You'll open this on your phone from bed.
- `shadcn-svelte` / `bits-ui` are mature; the "no components" objection is out of date.

Cost: smaller ecosystem, fewer 2 a.m. Stack Overflow answers. CodeMirror 6 is framework-agnostic,
so the one hard dependency is fine.

### 14.2 Structure

```
web/
├── src/lib/
│   ├── mxr.js / mxr.wasm         # ← built from libmxr, DO NOT hand-edit
│   ├── compiler/                 # shared workspace package
│   ├── editor/
│   │   ├── CardEditor.svelte     # CodeMirror + custom .card language mode
│   │   ├── Preview.svelte        # WASM canvas, 8× nearest-neighbour upscale
│   │   ├── Diagnostics.svelte
│   │   └── SlotInspector.svelte  # live slot values while editing
│   ├── design/
│   │   ├── PixelCanvas.svelte    # icon/sprite editor
│   │   └── IconLibrary.svelte
│   └── device/
│       ├── Mirror.svelte         # actual framebuffer, 2 fps, beside the preview
│       ├── Health.svelte
│       └── PowerMeter.svelte
└── src/routes/
    ├── +page.svelte              # device dashboard
    ├── cards/[slug]/+page.svelte # editor
    ├── scenes/+page.svelte       # drag-order playlist builder
    ├── rules/+page.svelte
    ├── sources/+page.svelte      # test-fetch any provider, see raw + parsed
    ├── firmware/+page.svelte
    └── provision/+page.svelte    # Web Bluetooth onboarding
```

### 14.3 The live preview loop

```svelte
<script lang="ts">
  import { compile } from "$lib/compiler";
  import { render } from "$lib/mxr";

  let source = $state(card.source);
  let slots  = $derived(liveSlots);                       // reactive Convex query

  let compiled = $derived.by(() => {
    try { return compile(source, sourceSchemas); }
    catch (e) { return { error: e }; }
  });

  let canvas: HTMLCanvasElement;

  $effect(() => {
    if (compiled.error) return;
    const fb = render(compiled.bytecode, slots, performance.now());
    blit(canvas, fb, 8);                                  // 8× nearest-neighbour
  });
</script>
```

That's the whole thing. Type a character, see the panel. No server, no round trip, no
approximation — the same C the device runs.

### 14.4 The device mirror

The device streams its actual framebuffer at 2 fps (only while the dashboard is open — a flag in
the heartbeat response toggles it). Display it **beside** the preview.

If they ever diverge, you have a bug and you see it instantly. In practice they never will, which
is the point.

### 14.5 Hosting

**Cloudflare Pages** with `adapter-cloudflare`. Free, git-push deploys, an ICN edge PoP, and it's
a static SPA plus WASM so there's nothing to compute server-side. Convex is reached directly from
the browser over its own reactive client.

---

## 15. Scenes & rules

Three layers, in precedence order. This is what makes it feel intelligent rather than a slideshow.

```
  ┌───────────────────────────────────────────────────────────┐
  │ 1. HomeKit          ← highest. Siri / Home app / automation│
  │    Explicit human intent always wins.                      │
  ├───────────────────────────────────────────────────────────┤
  │ 2. Rules            ← data-driven interrupts               │
  │    bus.eta <= 4 → pin.  air.pm25 > 75 → interrupt.         │
  ├───────────────────────────────────────────────────────────┤
  │ 3. Scene schedule   ← the baseline rotation                │
  └───────────────────────────────────────────────────────────┘
```

### 15.1 Scenes

```yaml
scenes:
  morning:
    when: "weekday and 06:30..09:30"
    cards: [bus-402, subway, weather, air, calendar-next]
    dwell: 8s
    brightnessCeiling: 100%

  day:
    when: "09:30..17:00"
    cards: [clock, weather, indoor-outdoor, calendar-next, github]
    dwell: 12s

  evening:
    when: "17:00..23:00"
    cards: [weather, nowplaying, bus-402, air, habits]
    dwell: 10s

  night:
    when: "23:00..06:30"
    cards: [clock-dim]
    brightnessCeiling: 3%

  away:
    when: "presence.home == false"
    cards: [clock]
    brightnessCeiling: 10%
```

Each scene gets a `homekitIdentifier`, so it appears as an input source in the Home app's
Television picker and in Control Center.

### 15.2 Rules

```yaml
rules:
  - name: "Bus urgent"
    when: "bus.eta_min <= 4 and scene == 'morning'"
    then: pin(bus-402, 60s)
    priority: 90

  - name: "Air quality alert"
    when: "air.pm25 > 75"
    then: interrupt(air-alert, 15s, every: 30m)
    priority: 95

  - name: "Earthquake"
    when: "quake.magnitude >= 3.0 and quake.age < 5m"
    then: takeover(quake-alert, 60s)
    priority: 100

  - name: "Last train"
    when: "subway.last_train_min <= 20 and now.hour >= 23"
    then: pin(last-train, 30s)
    priority: 85

  - name: "Sleep"
    when: "presence.bed == true for 10m and now.hour >= 22"
    then: scene(night)
    priority: 70

  - name: "Room empty"
    when: "presence.room == false for 15m"
    then: sleep()
    priority: 60
```

Same expression grammar as the DSL, so the compiler and the editor autocomplete are shared.

### 15.3 Interaction model

| Input | Effect |
|---|---|
| **Double-tap the frame** (LIS3DH) | Advance to next card, pause rotation 30 s |
| **Siri: "show me the bus"** | Stateless switch → `pin(bus-402, 60s)` |
| **Home app scene picker** | Direct scene select |
| **iPhone Shortcut → `/api/poke`** | Takeover message, 10 s |
| **Bed occupancy true** | Night scene via HomeKit automation |

No buttons. No holes in the bezel.

---

## 16. Card catalogue

Current Stage 1 sources in [`cards/`](./cards/) — **22 cards**. This is the live set,
not a wishlist.

| Slug | Name | Notes |
|---|---|---|
| `bus-402` | Bus | Multi-route ETAs (`eta` / `eta2` / `eta3`) |
| `weather` | Weather | KMA nowcast (`wx.*`) |
| `upcoming-weather` | Forecast | Hourly / upcoming strip |
| `air` | Air Quality | PM2.5 + grade (`air.*`) |
| `indoor` | Indoor | Room temp / humidity (`room.*`) |
| `calendar-next` | Calendar Next | Next event countdown |
| `clock` | Clock | Full-bright `now.hhmm` |
| `clock-dim` | Clock Dim | Night / low-brightness clock |
| `now-playing` | Now Playing | Ambient `np.*` from Spotify source |
| `github` | GitHub | Ambient `gh.*` + grass FX |
| `krw` | KRW/USD | Ambient `krw.*` from FX source |
| `todo` | Todo | Ambient `todo.*` |
| `dday` | D-Day | Ambient `dday.*` |
| `moon` | Moon | Synthesized phase / illumination |
| `year-progress` | Year | Synthesized day-of-year progress |
| `self-status` | Self Status | RSSI, uptime, program version |
| `fireplace` | Fireplace | Ambient FX |
| `life` | Life | Conway FX |
| `matrix` | Matrix | Matrix rain FX |
| `rain-fx` | Rain | Rain FX |
| `starfield` | Warp | Starfield FX |
| `iconsheet` | Weather Icons | Icon atlas (not seeded into demo playlist) |

Compile check: `npm run golden` (all 22 through `libmxr`).

---

## 17. Reliability checklist

Ordered by how much each one buys you.

- [ ] **A/B OTA with automatic rollback.** New firmware must call
      `esp_ota_mark_app_valid_cancel_rollback()` within 60 s or the bootloader reverts. You can
      never brick it from the couch.
- [ ] **Verify NVS survives OTA.** Otherwise every update un-pairs HomeKit. Test twice.
- [ ] **Last-good program + data persisted to SPIFFS.** First pixel within 400 ms of boot, with
      no network.
- [ ] **Power governor** (§7.3), calibrated with a real USB meter.
- [ ] **Watchdog + exponential backoff with jitter.** Hard reboot after 10 min of failure.
- [ ] **Compile-time validation.** Broken cards cannot be deployed.
- [ ] **Core affinity pinned.** Matrix on 0, HomeSpan and networking on 1.
- [ ] **Auto-brightness with hysteresis**, HomeKit value as ceiling not override.
- [ ] **Circuit breakers on every data source.** 5 failures → open 5 min.
- [ ] **Offline detection cron** → push notification to your phone. Learn it's down before you
      walk past it.
- [ ] **Snapshot tests in CI.** Every card renders to a PNG on every commit; diffs get reviewed
      like code. Catches font-metric regressions invisible until they're on your wall.
- [ ] **Device mirror beside the preview** in the dashboard.
- [ ] **Zero physical controls.** Double-tap only.
- [ ] **mmWave max-distance gated** so it doesn't see the neighbours.
- [ ] **BLE provisioning**, no serial console, no secrets in code.
- [ ] **`esp_wifi_set_ps(WIFI_PS_NONE)`** — mains powered; HAP responsiveness beats 30 mA.

---

## 18. Hosting, deploy & cost

### 18.1 Vendors

| Layer | Service | Region | Cost |
|---|---|---|---|
| Data, functions, device sync | **Convex Cloud** | US | $0 (free tier) |
| Korean API fetcher, Tailscale, CI runner, uptime | **Oracle Cloud Always Free** | `ICN` Seoul | $0 |
| Dashboard | **Cloudflare Pages** | ICN edge | $0 |
| Firmware + asset blobs | **Cloudflare R2** | — | $0 (zero egress fees) |
| Uptime alerting | **Better Stack** | — | $0 |
| **Total** | | | **$0/month** |

Four vendors, all free. Convex holds all state, so the Oracle box stays disposable: no Postgres
to back up, no broker to patch, and a rebuild is `git clone && docker compose up -d`.

### 18.2 Repository layout

```
matrix-panel/
├── firmware/          # ESP-IDF project
│   ├── main/
│   ├── components/libmxr/     → symlink to /libmxr
│   └── partitions.csv
├── libmxr/            # C99 renderer — the shared core
├── compiler/          # TS workspace pkg: parser → bytecode
├── convex/            # schema, queries, mutations, actions, crons, http
├── fetcher/           # Oracle ICN container (compose + Dockerfile)
├── web/               # SvelteKit dashboard
├── cards/             # .card sources, version-controlled
├── cad/               # OpenSCAD/Fusion sources + exported STLs
└── .github/workflows/
    ├── firmware.yml   # build → sign → upload R2 → register in Convex
    ├── wasm.yml       # emcc build → commit to web/src/lib
    └── cards.yml      # compile all cards → render PNGs → visual diff
```

### 18.3 Deploy commands

```bash
npx convex deploy                          # backend
cd web && npm run build && wrangler pages deploy   # dashboard
ssh oracle-icn 'cd /opt/matrix && git pull && docker compose up -d --build'  # Seoul fetcher
cd firmware && idf.py build && ./scripts/release.sh stable   # OTA
```

---

## 19. Build roadmap

Each phase is independently useful. Do not reorder — you don't want to debug optics and bytecode
simultaneously.

### Phase 1 — Light it up *(week 1)*
S3 + panel on the desk. ESP-IDF, HUB75 driver, hardcoded clock. Prove flicker-free refresh with
core 1 doing Wi-Fi. **Exit:** a clock that doesn't tear.

### Phase 2 — The renderer *(week 2)* ← the foundation
Write `libmxr`: VM + rasteriser + fonts. Compile to WASM. Build a bare HTML page that renders a
hand-written bytecode blob to a canvas. **Get preview == device before writing any DSL.**
**Exit:** identical output from a hand-assembled program on both targets.

### Phase 3 — Pipeline, **MXML Stage 0** *(week 3)*
Convex schema + HTTP actions. Oracle fetcher with the bus source. **No parser yet** — cards are
JSON display lists (§10.1). One card end to end. **Exit:** editing `bus-402.json` and running
`npx convex run` changes the panel. Ship your first 8 cards on this.

### Phase 3b — **MXML Stage 1** *(week 3–4)*
Only once Stage 0 has actually annoyed you. Lexer, recursive-descent parser, expression
evaluator, filters, `<when>` / `<show>` / `<stale>`. Absolute positioning still. **Exit:** the
bus card is written in MXML and the conditional red-at-3-minutes colour works.

### Phase 4 — Dashboard + simulate panel *(week 4)*
SvelteKit + CodeMirror + WASM preview + device mirror + **the simulate panel (§10.13)**. Build
the simulate panel before `row`/`col` — it pays back faster than any grammar feature.
**Exit:** you never touch a text editor for cards again. This is when it starts being fun.

### Phase 5 — Enclosure *(week 5)*
**Print the pixel grid tiles first and evaluate them alone against the bare panel.** Dial in wall
thickness and depth before committing to a bezel. Then bezel, rear shell, cleat, sensor windows.
**Exit:** it's on the shelf and looks bought.

### Phase 6 — HomeKit *(week 6)*
HomeSpan, all services, pairing, core-1 pinning. Verify NVS survives OTA. **Exit:** "Hey Siri,
turn off the matrix panel" works with the router unplugged.

### Phase 7 — Hardening *(week 7)*
OTA + rollback, BLE provisioning, power governor, auto-brightness, presence, stale handling,
health alerts, CI snapshot tests. Boring, and it's the entire difference between a project and
an appliance.

### Phase 7b — **MXML Stage 2** *(week 8+, optional)*
`row` / `col` / `pad` / `gap`, text measurement, `MEASURE` opcode. Build this only when
hand-placing coordinates has become the bottleneck. `<each>` is on probation — hand-unroll with
`<when>` guards first and see whether you ever miss it.

### Phase 8 — Forever
Add cards from the dashboard without touching firmware again. Which was the whole point.

---

## 20. Appendices

### A. Matrix Portal S3 pin budget

The S3 breakout strip is small — HUB75 consumes most GPIO. Verify every assignment against the
Adafruit pinout guide for your board revision before wiring.

| Function | Connection | Notes |
|---|---|---|
| HUB75 R1 G1 B1 R2 G2 B2 A B C D CLK LAT OE | Onboard | Do not touch |
| I²C — VEML7700, SHT41, LIS3DH, RTC | **STEMMA QT** → 5-port hub | Zero soldering |
| LD2410C | UART: TX/RX breakout pins | 256000 baud default |
| LD2450 *(optional)* | Second UART on two spare GPIO | Software UART if needed |
| HX711 | 2 × GPIO (DOUT, SCK) | Bit-banged, 2 Hz is plenty |
| Address E | Solder jumper | 64×32 doesn't need it; leave it |

If you run out of pins: drop the LD2450 (the LD2410C + load cell cover the actual need), or move
the HX711 to an I²C ADC.

### B. Korean API registration

| API | Portal | Notes |
|---|---|---|
| 버스도착정보 | data.go.kr | Requires 활용신청; approval is usually same-day. Find your stop's `arsId` on the physical sign |
| 지하철 실시간도착 | data.seoul.go.kr | Separate key from data.go.kr |
| 단기예보 / 초단기실황 | data.go.kr (기상청) | Uses `nx`/`ny` grid coords, **not** lat/lon — convert once, hardcode |
| 대기오염정보 | data.go.kr (한국환경공단) | Station name, not coords |
| 지진정보 | data.go.kr (기상청) | Low volume, poll 60 s |
| 따릉이 | data.seoul.go.kr | Station ID per dock |
| 특일정보 (holidays) | data.go.kr | Yearly cache is fine |

Rate limits are generous (typically 1,000/day dev, 10,000+ on approval), but a 20 s bus poll is
4,320/day — **request the raised quota when you apply**, and back off to 60 s outside your
morning window.

### C. Colour & typography on 64×32

- **Use RGB565, and gamma-correct.** Linear 8-bit values look wrong on LEDs; an 8→12-bit gamma
  LUT (γ≈2.2) is the difference between muddy and vivid.
- **Never pure white for body text.** `#e0e0e0` at the same brightness reads cleaner and draws
  ~12% less current.
- **Avoid pure blue on black** — the lowest-luminance channel, it looks dim and fringes. Use
  `#4488ff` rather than `#0000ff`.
- **Tabular numerals always** for anything that changes (`<digits tabular>`). Non-tabular digits
  make a clock jitter horizontally and it's maddening at a glance.
- **3×5 font for labels, 5×7 for values.** Two sizes maximum per card. Three is noise at this
  resolution.
- **One accent colour per card.** At 64×32 a second accent reads as chaos.
- **Never all-caps for design** — mixed case is more legible at 5 px height and reads calmer.

### D. Things that will bite you

| Problem | Fix |
|---|---|
| Panel tears when the Home app polls | HomeSpan is on core 0. Pin it to 1. |
| Colours shift under load | Brownout. Better PSU + power governor. |
| Firmware update un-pairs HomeKit | Partition table erases NVS. Fix `partitions.csv`. |
| mmWave detects the neighbours | Gate max distance; set far-gate sensitivity to 0. |
| mmWave goes blind while you're in bed | Background recalibration ran. Never trigger it from boot. |
| Preview doesn't match the panel | You edited the WASM build by hand, or the font tables diverged. Rebuild from `libmxr`. |
| Clock digits jitter | Non-tabular font. Use `<digits tabular>`. |
| Bezel bows in summer | PLA in an enclosed mount. Reprint in ASA. |
| Grid tiles show visible seams | Seams didn't land on cell walls. Re-split at exact 16-px boundaries. |
| Korean text renders as boxes | Glyph missing from the subset. The compiler should have warned — check it's wired up. |
| Bus API returns nothing at 03:00 | Service ended. Handle empty arrays as a state, not an error. |

---

*Plan v1.2 — Matrix Portal S3 · Convex · Oracle Cloud ICN · SvelteKit · HomeSpan · no MQTT*
