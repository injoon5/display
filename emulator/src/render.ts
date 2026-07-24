import { spawnSync } from "node:child_process";
import { accessSync, constants, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { readPpmToRgb565, rgb565ToBmp } from "./bmp.js";
import type { DataFrame } from "./device-client.js";
import { frameToSlotsText } from "./slots.js";

export type RenderResult = {
  amps: number;
  bmp: Buffer;
  ppmPath: string;
  bmpPath: string;
};

export function ensureRenderBin(renderBin: string, repoRoot: string): string {
  try {
    accessSync(renderBin, constants.X_OK);
    return renderBin;
  } catch {
    const build = spawnSync("make", ["-C", join(repoRoot, "libmxr"), "render_ppm"], {
      encoding: "utf8",
    });
    if (build.status !== 0) {
      throw new Error(`failed to build render_ppm:\n${build.stdout}\n${build.stderr}`);
    }
    return renderBin;
  }
}

export function renderFrame(opts: {
  renderBin: string;
  stateDir: string;
  programPath: string;
  frame: DataFrame | null;
  tMs: number;
}): RenderResult {
  mkdirSync(opts.stateDir, { recursive: true });
  const slotsPath = join(opts.stateDir, "slots.txt");
  const ppmPath = join(opts.stateDir, "frame.ppm");
  const bmpPath = join(opts.stateDir, "frame.bmp");

  if (opts.frame) {
    writeFileSync(slotsPath, frameToSlotsText(opts.frame), "utf8");
  } else {
    writeFileSync(slotsPath, "# empty\n", "utf8");
  }

  const args = [opts.programPath, ppmPath, "--t-ms", String(opts.tMs)];
  if (opts.frame) {
    args.push("--slots", slotsPath);
  }

  const result = spawnSync(opts.renderBin, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `render_ppm failed (${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }

  const ppm = readFileSync(ppmPath);
  const { width, height, pixels } = readPpmToRgb565(ppm);
  const bmp = rgb565ToBmp(pixels, width, height);
  writeFileSync(bmpPath, bmp);

  const ampsMatch = /([0-9.]+)\s*A/.exec(result.stdout ?? "");
  const amps = ampsMatch ? Number(ampsMatch[1]) : 0;

  // touch dirname so watchers see updates
  void dirname(bmpPath);

  return { amps, bmp, ppmPath, bmpPath };
}
