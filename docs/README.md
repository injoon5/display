# Docs

Everything you need to understand, run, ship, and extend the Wall Matrix Panel.

| Doc | When you need it |
|---|---|
| [Getting started](./getting-started.md) | First clone → panel on a browser in ~60s |
| [Architecture](./architecture.md) | How the pieces fit, and why they exist |
| [Packages](./packages.md) | Monorepo map, scripts, ownership |
| [MXML](./mxml.md) | Write / compile / preview cards |
| [Device protocol](./device-protocol.md) | What the panel speaks over HTTPS |
| [Operations](./operations.md) | Build, run, deploy, debug, day-2 ops |
| [Roadmap](./roadmap.md) | What's shipped vs what's left after hardware |
| [Full build plan](./plan.md) | Hardware, BOM, enclosure, HomeKit, deep design |

## One-liner

```bash
npm ci && npm run stack
```

| Service | URL |
|---|---|
| Dashboard | http://127.0.0.1:5173 |
| Device emulator preview | http://127.0.0.1:8787 |
| Convex API | http://127.0.0.1:3210 |
| Convex HTTP (device) | http://127.0.0.1:3211 |

Demo secrets: device token `dev-token-matrix-panel-demo` · dashboard `dashboard-secret`.

## Mental model in four bullets

1. **Cards are MXML** → compile to **MXR1 bytecode** (never parsed on-device).
2. **`libmxr` is the renderer** — same C99 → ESP32 *and* WASM/native preview. Byte-identical.
3. **Convex is the control+content brain** — schema, compile/deploy, long-poll device HTTP, crons.
4. **The Seoul fetcher is disposable** — Oracle ICN (or local) polls Korean APIs and writes into Convex. Dummy plugins until you add keys.

## Principles (locked)

See [plan §1](./plan.md#1-principles). Short version:

- Device is a renderer, not a computer
- One renderer, compiled twice
- Control plane local (HomeKit/LAN); content plane cloud
- Degrade quietly
- Invalid states fail at compile time
