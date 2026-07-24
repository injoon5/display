import "dotenv/config";

export type EmulatorConfig = {
  siteUrl: string;
  deviceToken: string;
  previewPort: number;
  heartbeatMs: number;
  renderBin: string;
  stateDir: string;
  fwVersion: string;
};

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name]?.trim() || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(rootDir: string): EmulatorConfig {
  const siteUrl = requireEnv(
    "CONVEX_SITE_URL",
    process.env.MX_SITE_URL?.trim() || "http://127.0.0.1:3211",
  ).replace(/\/$/, "");

  return {
    siteUrl,
    deviceToken: requireEnv(
      "DEVICE_TOKEN",
      process.env.MX_DEVICE_TOKEN?.trim() || "dev-token-matrix-panel-demo",
    ),
    previewPort: Number(process.env.EMULATOR_PORT ?? process.env.PREVIEW_PORT ?? 8787),
    heartbeatMs: Number(process.env.HEARTBEAT_MS ?? 10_000),
    renderBin: process.env.MXR_RENDER_BIN?.trim() || `${rootDir}/libmxr/render_ppm`,
    stateDir: process.env.EMULATOR_STATE_DIR?.trim() || `${rootDir}/tmp/emulator`,
    fwVersion: process.env.FW_VERSION?.trim() || "1.4.2-emu",
  };
}
