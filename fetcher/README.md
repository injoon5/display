# Seoul Oracle ICN Fetcher

Stateless Node fetcher for the Wall Matrix Panel. It polls Seoul-shaped dummy sources on a fixed
schedule and writes the results into Convex with `ConvexHttpClient`.

This build is intentionally **dummy-only**: no real Korean API keys are required, but the payloads
look realistic for Seoul transit, weather, air quality, quakes, and bike docks.

## Sources

| Source ID | Kind | Interval |
| --- | --- | ---: |
| `bus` | `seoul.bus` | 20s |
| `subway` | `seoul.subway` | 30s |
| `wx` | `kma.now` | 600s |
| `wx-fcst` | `kma.forecast` | 1800s |
| `rain` | `kma.nowcast` | 300s |
| `air` | `airkorea` | 600s |
| `quake` | `kma.quake` | 60s |
| `bike` | `seoul.bike` | 120s |

## Convex auth and writes

The fetcher writes through:

- `api.sources.write`
- `api.sources.writeError`

It matches the current backend shape in `/workspace/convex/sources.ts`:

- success writes send `sourceId`, `kind`, `config`, `intervalMs`, `origin`, `data`, and `fetchedAt`
- error writes send `sourceId`, `kind`, `config`, `intervalMs`, `origin`, and `error`

If `CONVEX_SERVICE_TOKEN` or `CONVEX_DEPLOY_KEY` is present, the fetcher calls
`convex.setAdminAuth(...)`. If neither is present, it uses the current public mutations directly.

## Local run

```bash
cd fetcher
cp .env.example .env
npm install
npm run dev
```

Build output:

```bash
npm run build
npm start
```

## Docker

The compose file expects to be run from this directory:

```bash
cd fetcher
cp .env.example .env
docker compose up -d --build
```

Optional Tailscale sidecar:

```bash
docker compose --profile ops up -d
```

`docker-compose.yml` includes:

- `fetcher`
- `tailscale` as an optional profile stub
- `uptime-kuma`

## Oracle ICN deployment notes

Recommended target from the wall-matrix plan:

- Region: **ICN (Seoul)**
- Shape: `VM.Standard.A1.Flex`
- OS: Ubuntu 24.04 ARM64
- Provisioning advice: **1 OCPU / 6 GB RAM**

Why 1 OCPU instead of 4:

- the fetcher is mostly idle
- Oracle idle-reclamation thresholds are percentage-based
- 1 OCPU makes legitimate usage more likely to clear the threshold than 4 OCPUs

### PAYG tip

If you can, upgrade the Oracle account to **Pay As You Go** while staying inside the Always Free
limits. The normal advice for this box is:

- PAYG account
- still use only Always Free resources
- keep the bill at zero
- avoid idle reclamation risk

## Dummy data behavior

Each plugin rotates realistic values over time:

- bus and subway ETAs count down and roll over
- weather follows Seoul-ish seasonal and day/night swings
- air quality changes gradually with grade buckets
- quake is usually empty with a rare fake event
- bike docks show changing availability

This makes the dashboard and Convex rules usable before real Korean API keys exist.
