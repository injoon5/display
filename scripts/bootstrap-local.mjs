#!/usr/bin/env node
/**
 * Bootstrap a local Convex deployment for the wall matrix panel:
 * seed demo device/cards/sources, then compileAndDeploy a program.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function purgeConvexJsEmit() {
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) {
        if (name.name === "_generated" || name.name === "node_modules") continue;
        walk(path);
        continue;
      }
      if (name.name.endsWith(".js") || name.name.endsWith(".js.map")) {
        try {
          unlinkSync(path);
        } catch {
          // ignore
        }
      }
    }
  };
  walk(join(root, "convex"));
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous", ...opts.env },
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function readEnvLocal() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) {
    return {};
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function writeEnvFile(path, values) {
  mkdirSync(dirname(path), { recursive: true });
  const body = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(path, `${body}\n`, "utf8");
}

function parseJsonLoose(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error(`expected JSON object in:\n${text}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

const envLocal = readEnvLocal();
const convexUrl = process.env.CONVEX_URL || envLocal.CONVEX_URL || "http://127.0.0.1:3210";
const siteUrl = process.env.CONVEX_SITE_URL || envLocal.CONVEX_SITE_URL || "http://127.0.0.1:3211";

console.log(`[bootstrap] CONVEX_URL=${convexUrl}`);
console.log(`[bootstrap] CONVEX_SITE_URL=${siteUrl}`);

purgeConvexJsEmit();

// Ensure compiler is built (Convex action imports it).
run("npm", ["run", "build", "-w", "@matrix-panel/compiler"]);

const seedOut = run("npx", ["convex", "run", "lib/seed:seedDemo", "{}"]);
const seed = parseJsonLoose(seedOut);
console.log(`[bootstrap] seeded device=${seed.deviceId} cards=${seed.cardIds?.length ?? 0}`);

if (!seed.deviceId || !Array.isArray(seed.cardIds) || seed.cardIds.length === 0) {
  throw new Error("seedDemo did not return deviceId/cardIds");
}

const deployArgs = JSON.stringify({
  deviceId: seed.deviceId,
  cardIds: seed.cardIds,
});
const deployOut = run("npx", ["convex", "run", "programsActions:compileAndDeploy", deployArgs]);
const deploy = parseJsonLoose(deployOut);
console.log(`[bootstrap] deployed size=${deploy.size} etag=${deploy.etag}`);

writeEnvFile(join(root, "web", ".env.local"), {
  PUBLIC_CONVEX_URL: convexUrl,
});

writeEnvFile(join(root, "fetcher", ".env"), {
  CONVEX_URL: convexUrl,
});

writeEnvFile(join(root, "emulator", ".env"), {
  CONVEX_URL: convexUrl,
  CONVEX_SITE_URL: siteUrl,
  DEVICE_TOKEN: "dev-token-matrix-panel-demo",
  EMULATOR_PORT: "8787",
});

writeEnvFile(join(root, "tmp", "local-stack.env"), {
  CONVEX_URL: convexUrl,
  CONVEX_SITE_URL: siteUrl,
  PUBLIC_CONVEX_URL: convexUrl,
  DEVICE_TOKEN: "dev-token-matrix-panel-demo",
  DASHBOARD_SECRET: "dashboard-secret",
  EMULATOR_PORT: "8787",
  WEB_URL: "http://127.0.0.1:5173",
  EMULATOR_URL: "http://127.0.0.1:8787",
});

console.log("[bootstrap] wrote web/.env.local, fetcher/.env, emulator/.env");
console.log("[bootstrap] done");
