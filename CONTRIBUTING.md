# Contributing

## Prerequisites

- Node.js 22+
- npm
- CMake / make / a C99 compiler (for `libmxr` + `firmware/host_sim`)
- optional: Emscripten (`emcc`) for `libmxr` wasm output
- optional: ESP-IDF v5.x for device firmware builds

## Install

```bash
npm ci
```

## Fully local stack

Preferred path — no hardware, no cloud Convex account required (anonymous agent mode):

```bash
npm run stack
```

This starts:

1. Local Convex (`CONVEX_AGENT_MODE=anonymous`)
2. Demo seed + `compileAndDeploy`
3. Seoul fetcher (dummy plugins → `sources:write`)
4. SvelteKit dashboard on `:5173`
5. Device emulator on `:8787` (real `/device/*` loop + `libmxr/render_ppm` frames)

## Common local commands

```bash
npm run typecheck
npm run build
npm run test
npm run bootstrap          # seed + deploy (Convex must already be running)
npm run emulate            # device emulator only
```

## Cards

```bash
npm run build -w compiler
```

Then use the command block in `cards/README.md` to compile every `*.card`
(and optional `*.json` Stage 0 cards if present).

## Offline firmware host simulator

Hardcoded MXR → PPM (does **not** talk to Convex):

```bash
cmake -S firmware/host_sim -B firmware/host_sim/build
cmake --build firmware/host_sim/build
./firmware/host_sim/build/mx_host_sim
```

For a live device loop, use `npm run emulate` / `npm run stack`.

## Optional wasm build

If `emcc` is available:

```bash
npm run mxr:wasm -w web
```
