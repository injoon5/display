import "dotenv/config";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { airKoreaPlugin } from "./plugins/airkorea.js";
import { kmaForecastPlugin } from "./plugins/kma.forecast.js";
import { kmaNowPlugin } from "./plugins/kma.now.js";
import { kmaNowcastPlugin } from "./plugins/kma.nowcast.js";
import { kmaQuakePlugin } from "./plugins/kma.quake.js";
import { seoulBikePlugin } from "./plugins/seoul.bike.js";
import { seoulBusPlugin } from "./plugins/seoul.bus.js";
import { seoulSubwayPlugin } from "./plugins/seoul.subway.js";
import { jitter, withTimeout } from "./util.js";

type SourceWriteArgs = {
  sourceId: string;
  intervalMs: number;
  kind: string;
  config: Record<string, unknown>;
  origin: "convex" | "oracle-icn";
  data: unknown;
  fetchedAt?: number;
};

type SourceWriteErrorArgs = Omit<SourceWriteArgs, "data" | "fetchedAt"> & { error: string };

type RunnableSource = {
  sourceId: string;
  intervalMs: number;
  kind: string;
  config: Record<string, unknown>;
  fetch: () => Promise<unknown>;
};

function requireEnv(name: "CONVEX_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const convex = new ConvexHttpClient(requireEnv("CONVEX_URL"), { logger: false });
const convexAdmin = convex as ConvexHttpClient & { setAdminAuth(token: string): void };
const writeSource = makeFunctionReference<"mutation", SourceWriteArgs>("sources:write");
const writeSourceError = makeFunctionReference<"mutation", SourceWriteErrorArgs>("sources:writeError");
const adminToken = process.env.CONVEX_SERVICE_TOKEN?.trim() || process.env.CONVEX_DEPLOY_KEY?.trim();
if (adminToken) {
  convexAdmin.setAdminAuth(adminToken);
}

const sourceTimeoutMs = Number(process.env.FETCH_TIMEOUT_MS ?? 8_000);
if (!Number.isFinite(sourceTimeoutMs) || sourceTimeoutMs <= 0) {
  throw new Error("FETCH_TIMEOUT_MS must be a positive number");
}
const origin = "oracle-icn" as const;
let shuttingDown = false;

const sources: RunnableSource[] = [
  {
    sourceId: "bus",
    intervalMs: 20_000,
    kind: seoulBusPlugin.kind,
    config: {
      arsId: "23-005",
      route: "402",
      stopName: "Seocho Culture Arts Center",
      headsign: "Gangnam Station",
    },
    fetch: () =>
      seoulBusPlugin.fetch({
        arsId: "23-005",
        route: "402",
        stopName: "Seocho Culture Arts Center",
        headsign: "Gangnam Station",
      }),
  },
  {
    sourceId: "subway",
    intervalMs: 30_000,
    config: { line: "Line 2", station: "Gangnam", direction: "Seongsu-bound" },
    kind: seoulSubwayPlugin.kind,
    fetch: () => seoulSubwayPlugin.fetch({ line: "Line 2", station: "Gangnam", direction: "Seongsu-bound" }),
  },
  {
    sourceId: "wx",
    intervalMs: 600_000,
    config: { station: "Seoul-108" },
    kind: kmaNowPlugin.kind,
    fetch: () => kmaNowPlugin.fetch({ station: "Seoul-108" }),
  },
  {
    sourceId: "wx-fcst",
    intervalMs: 1_800_000,
    config: { station: "Seoul-108" },
    kind: kmaForecastPlugin.kind,
    fetch: () => kmaForecastPlugin.fetch({ station: "Seoul-108" }),
  },
  {
    sourceId: "rain",
    intervalMs: 300_000,
    config: { district: "Gangnam-gu" },
    kind: kmaNowcastPlugin.kind,
    fetch: () => kmaNowcastPlugin.fetch({ district: "Gangnam-gu" }),
  },
  {
    sourceId: "air",
    intervalMs: 600_000,
    config: { station: "Gangnam-gu" },
    kind: airKoreaPlugin.kind,
    fetch: () => airKoreaPlugin.fetch({ station: "Gangnam-gu" }),
  },
  {
    sourceId: "quake",
    intervalMs: 60_000,
    config: { region: "Korean Peninsula" },
    kind: kmaQuakePlugin.kind,
    fetch: () => kmaQuakePlugin.fetch({ region: "Korean Peninsula" }),
  },
  {
    sourceId: "bike",
    intervalMs: 120_000,
    config: { stationId: "ST-718", stationName: "Seolleung Station Exit 1", capacity: 24 },
    kind: seoulBikePlugin.kind,
    fetch: () => seoulBikePlugin.fetch({ stationId: "ST-718", stationName: "Seolleung Station Exit 1", capacity: 24 }),
  },
];

async function runSource(source: RunnableSource): Promise<void> {
  const startedAt = Date.now();
  try {
    const data = await withTimeout(source.fetch(), sourceTimeoutMs, source.kind);
    await convex.mutation(writeSource, {
      sourceId: source.sourceId,
      kind: source.kind,
      config: source.config,
      intervalMs: source.intervalMs,
      origin,
      data,
      fetchedAt: Date.now(),
    });
    console.log(`[ok] ${source.sourceId} ${Date.now() - startedAt}ms`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await convex.mutation(writeSourceError, {
      sourceId: source.sourceId,
      kind: source.kind,
      config: source.config,
      intervalMs: source.intervalMs,
      origin,
      error: message,
    });
    console.error(`[error] ${source.sourceId} ${message}`);
  } finally {
    if (!shuttingDown) {
      setTimeout(() => void runSource(source), source.intervalMs + jitter(source.intervalMs));
    }
  }
}

function handleSignal(signal: string): void {
  shuttingDown = true;
  console.log(`[stop] ${signal}`);
  setTimeout(() => process.exit(0), 250);
}

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));
process.on("unhandledRejection", (error: unknown) => {
  console.error("[fatal] unhandledRejection", error);
});

console.log(`[boot] Starting Seoul fetcher for ${sources.length} sources via ${convex.url}`);
console.log(adminToken ? "[boot] Using Convex admin auth token" : "[boot] Using public Convex mutations");
for (const [index, source] of sources.entries()) {
  setTimeout(() => void runSource(source), index * 750);
}
