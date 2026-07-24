import "dotenv/config";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.js";
import { DeviceClient, type DataFrame } from "./device-client.js";
import { startPreviewServer, type PreviewState } from "./preview-server.js";
import { ensureRenderBin, renderFrame } from "./render.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const config = loadConfig(repoRoot);
const client = new DeviceClient(config.siteUrl, config.deviceToken);

mkdirSync(config.stateDir, { recursive: true });
ensureRenderBin(config.renderBin, repoRoot);

const programPath = join(config.stateDir, "program.mxr");
let programBytes: Uint8Array | null = null;
let programEtag = "boot";
let dataEtag = "boot";
let programVersion = 0;
let dataVersion = 0;
let frame: DataFrame | null = null;
let amps = 0;
let frameCount = 0;
let lastError: string | null = null;
let lastHeartbeatAt: number | null = null;
let lastRenderAt: number | null = null;
let bmp: Buffer | null = null;
let ppm: Buffer | null = null;
let running = true;
let brightnessCeiling = 100;
const startedAt = Date.now();

const preview = startPreviewServer(
  config.previewPort,
  (): PreviewState => ({
    amps,
    dataEtag,
    dataVersion,
    frameCount,
    lastError,
    lastHeartbeatAt,
    lastRenderAt,
    online: true,
    programEtag,
    programVersion,
    siteUrl: config.siteUrl,
    startedAt,
  }),
  () => ({ bmp, ppm }),
);

console.log(`[emulator] site=${config.siteUrl}`);
console.log(`[emulator] preview=${preview.url}`);
console.log(`[emulator] token=${config.deviceToken.slice(0, 8)}…`);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshProgram(force = false): Promise<void> {
  const sync = await client.sync(force ? undefined : programEtag === "boot" ? undefined : programEtag);
  if (sync.kind === "notModified") {
    programEtag = sync.etag || programEtag;
    return;
  }
  if (sync.kind === "error") {
    throw new Error(`sync ${sync.status}: ${sync.body}`);
  }

  const bytes = await client.fetchBytecode(sync.manifest.bytecodeUrl);
  writeFileSync(programPath, bytes);
  programBytes = bytes;
  programEtag = sync.etag || sync.manifest.etag;
  programVersion = sync.manifest.programVersion;
  if (typeof sync.manifest.brightnessCeiling === "number") {
    brightnessCeiling = Math.max(0, Math.min(100, sync.manifest.brightnessCeiling));
  }
  console.log(
    `[emulator] program v${programVersion} etag=${programEtag} bytes=${bytes.byteLength} brightnessCeiling=${brightnessCeiling}`,
  );
}

async function refreshData(force = false): Promise<void> {
  const result = await client.data(force ? undefined : dataEtag === "boot" ? undefined : dataEtag);
  if (result.kind === "notModified") {
    dataEtag = result.etag || dataEtag;
    return;
  }
  if (result.kind === "error") {
    throw new Error(`data ${result.status}: ${result.body}`);
  }

  frame = result.frame;
  dataEtag = result.etag;
  dataVersion = result.frame.v;
  console.log(`[emulator] data v${dataVersion} etag=${dataEtag}`);
}

function paint(): void {
  if (!programBytes) {
    return;
  }

  const rendered = renderFrame({
    renderBin: config.renderBin,
    stateDir: config.stateDir,
    programPath,
    frame,
    tMs: Date.now() - startedAt,
  });

  amps = rendered.amps;
  bmp = rendered.bmp;
  ppm = readFileSync(rendered.ppmPath);
  frameCount += 1;
  lastRenderAt = Date.now();
  lastError = null;
}

async function heartbeat(): Promise<void> {
  const brightness = Math.round((48 * brightnessCeiling) / 100);
  await client.heartbeat({
    fw: config.fwVersion,
    programVersion,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    rssi: -42,
    heapFree: 180_000,
    psramFree: 2_000_000,
    brightness,
    lux: 120,
    tempC: 36.5,
    humidity: 41,
    presenceRoom: true,
    presenceBed: false,
    estAmps: amps,
    governorActive: false,
    lastError: lastError ?? undefined,
  });
  lastHeartbeatAt = Date.now();
}

async function bootstrap(): Promise<void> {
  // Initial sync may fail until seed+deploy; retry until a program exists.
  for (let attempt = 1; attempt <= 60 && running; attempt += 1) {
    try {
      await refreshProgram(true);
      await refreshData(true);
      paint();
      await heartbeat();
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(`[emulator] bootstrap ${attempt}/60: ${lastError}`);
      await sleep(2000);
    }
  }
  throw new Error(`bootstrap failed: ${lastError ?? "unknown"}`);
}

async function loop(): Promise<void> {
  await bootstrap();

  let nextHeartbeat = Date.now() + config.heartbeatMs;

  while (running) {
    try {
      const wait = await client.wait(programEtag, dataEtag);
      if (wait.kind === "unauthorized") {
        throw new Error("Unauthorized — seed demo device token first");
      }
      if (wait.kind === "error") {
        throw new Error(`wait ${wait.status}: ${wait.body}`);
      }

      if (wait.kind === "changed") {
        if (wait.program || programEtag === "boot") {
          await refreshProgram(true);
        }
        if (wait.data || dataEtag === "boot") {
          await refreshData(true);
        }
        paint();
      } else {
        // idle timeout — still re-render for animations (t_ms)
        paint();
      }

      if (Date.now() >= nextHeartbeat) {
        await heartbeat();
        nextHeartbeat = Date.now() + config.heartbeatMs;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[emulator] loop error: ${lastError}`);
      await sleep(2000);
    }
  }
}

function shutdown(): void {
  running = false;
  void preview.close().finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

loop().catch((error) => {
  console.error(error);
  process.exit(1);
});
