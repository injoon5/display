# Contributing

## Prerequisites

- Node.js 22+
- npm
- CMake (for `firmware/host_sim`)
- optional: Emscripten (`emcc`) for `libmxr` wasm output
- optional: ESP-IDF v5.x for device firmware builds

## Install

```bash
npm ci
```

## Common local commands

Typecheck everything that currently has checks wired up:

```bash
npm run typecheck
```

Build the main workspaces:

```bash
npm run build
```

Run compiler tests:

```bash
npm run test
```

## Dashboard + Convex

Start a local Convex dev deployment in one terminal:

```bash
npx convex dev
```

Run the dashboard in another:

```bash
npm run web:dev
```

## Cards

Build the compiler and validate the checked-in cards:

```bash
npm run build -w compiler
```

Then use the command block in `cards/README.md` to compile every `*.json` and `*.card`.

## Firmware host simulator

```bash
cmake -S firmware/host_sim -B firmware/host_sim/build
cmake --build firmware/host_sim/build
./firmware/host_sim/build/mx_host_sim
```

## Optional wasm build

If `emcc` is available:

```bash
npm run mxr:wasm -w web
```
