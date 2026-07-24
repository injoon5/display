#!/usr/bin/env node
/**
 * One-command local stack:
 *   Convex (anonymous) + seed/deploy + fetcher + dashboard + device emulator
 *
 * Usage: npm run stack
 *        npm run stack -- --no-web
 *        npm run stack -- --bootstrap-only
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const noWeb = args.has("--no-web");
const noFetcher = args.has("--no-fetcher");
const noEmulator = args.has("--no-emulator");
const bootstrapOnly = args.has("--bootstrap-only");
const skipBootstrap = args.has("--skip-bootstrap");

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

function log(msg) {
  console.log(`[stack] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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
          log(`removed accidental emit ${path.slice(root.length + 1)}`);
        } catch {
          // ignore
        }
      }
    }
  };
  walk(join(root, "convex"));
}

function spawnProc(label, command, cmdArgs, env = {}) {
  log(`start ${label}: ${command} ${cmdArgs.join(" ")}`);
  const child = spawn(command, cmdArgs, {
    cwd: root,
    env: {
      ...process.env,
      CONVEX_AGENT_MODE: "anonymous",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (buf) => process.stdout.write(`[${label}] ${buf}`));
  child.stderr.on("data", (buf) => process.stderr.write(`[${label}] ${buf}`));
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      log(`${label} exited code=${code} signal=${signal}`);
    }
  });
  children.push(child);
  return child;
}

async function waitForHttp(url, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status >= 0) {
        return;
      }
    } catch {
      // retry
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function waitForConvexReady() {
  const url = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const site = process.env.CONVEX_SITE_URL || "http://127.0.0.1:3211";
  log(`waiting for Convex at ${url}`);
  await waitForHttp(url);
  log(`waiting for Convex site at ${site}`);
  await waitForHttp(site);
  // Give codegen/push a beat after the ports open.
  await sleep(2000);
}

function ensureEnvLocal() {
  const path = join(root, ".env.local");
  if (existsSync(path)) {
    return;
  }
  writeFileSync(
    path,
    [
      "CONVEX_AGENT_MODE=anonymous",
      "CONVEX_URL=http://127.0.0.1:3210",
      "CONVEX_SITE_URL=http://127.0.0.1:3211",
      "",
    ].join("\n"),
    "utf8",
  );
  log("wrote .env.local");
}

function buildRenderPpm() {
  const result = spawnSync("make", ["-C", join(root, "libmxr"), "render_ppm"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`make render_ppm failed:\n${result.stdout}\n${result.stderr}`);
  }
  log("libmxr/render_ppm ready");
}

async function runBootstrap() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("node", [join(root, "scripts", "bootstrap-local.mjs")], {
      cwd: root,
      env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`bootstrap failed with code ${code}`));
    });
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("shutting down…");
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(code), 800).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  purgeConvexJsEmit();
  ensureEnvLocal();
  buildRenderPpm();

  spawnProc("convex", "npx", ["convex", "dev"], {
    CONVEX_AGENT_MODE: "anonymous",
  });

  await waitForConvexReady();

  if (!skipBootstrap) {
    // Retry bootstrap a few times — convex push may still be finishing.
    let lastError = null;
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      try {
        await runBootstrap();
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        log(`bootstrap attempt ${attempt}/8 failed; retrying…`);
        await sleep(2500);
      }
    }
    if (lastError) {
      throw lastError;
    }
  }

  if (bootstrapOnly) {
    log("bootstrap-only complete");
    shutdown(0);
    return;
  }

  if (!noFetcher) {
    spawnProc("fetcher", "npm", ["run", "dev", "-w", "@wall-matrix-panel/fetcher"], {
      CONVEX_URL: process.env.CONVEX_URL || "http://127.0.0.1:3210",
    });
  }

  if (!noWeb) {
    spawnProc(
      "web",
      "npm",
      ["run", "dev", "-w", "@matrix-panel/web", "--", "--host", "127.0.0.1", "--port", "5173"],
      {
        PUBLIC_CONVEX_URL: process.env.CONVEX_URL || "http://127.0.0.1:3210",
      },
    );
  }

  if (!noEmulator) {
    spawnProc("emulator", "npm", ["run", "dev", "-w", "@matrix-panel/emulator"], {
      CONVEX_URL: process.env.CONVEX_URL || "http://127.0.0.1:3210",
      CONVEX_SITE_URL: process.env.CONVEX_SITE_URL || "http://127.0.0.1:3211",
      DEVICE_TOKEN: "dev-token-matrix-panel-demo",
      EMULATOR_PORT: "8787",
    });
  }

  log("────────────────────────────────────────");
  log("local stack is up");
  log("  Convex API : http://127.0.0.1:3210");
  log("  Convex HTTP: http://127.0.0.1:3211");
  if (!noWeb) log("  Dashboard  : http://127.0.0.1:5173");
  if (!noEmulator) log("  Emulator   : http://127.0.0.1:8787");
  log("  Device tok : dev-token-matrix-panel-demo");
  log("Ctrl+C to stop");
  log("────────────────────────────────────────");

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
