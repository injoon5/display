#!/usr/bin/env node
/**
 * Golden path: compile every cards/* source with @matrix-panel/compiler,
 * then validate+render through native libmxr (same bytecode contract as firmware).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@matrix-panel/compiler";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = join(root, "cards");
const outDir = join(root, "tmp", "mxr-golden");
mkdirSync(outDir, { recursive: true });

const build = spawnSync("make", ["-C", join(root, "libmxr"), "validate_file"], {
  encoding: "utf8",
});
if (build.status !== 0) {
  console.error(build.stdout);
  console.error(build.stderr);
  process.exit(1);
}

const validateBin = join(root, "libmxr", "validate_file");
const files = readdirSync(cardsDir).filter((name) => name.endsWith(".json") || name.endsWith(".card"));
let failed = 0;

for (const name of files) {
  const source = readFileSync(join(cardsDir, name), "utf8");
  const result = compile(name.endsWith(".json") ? JSON.parse(source) : source);
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    console.error(`compile failed: ${name}`);
    for (const error of errors) {
      console.error(`  ${error.message}`);
    }
    failed += 1;
    continue;
  }

  const outPath = join(outDir, `${name}.mxr`);
  writeFileSync(outPath, result.bytecode);
  const validate = spawnSync(validateBin, [outPath], { encoding: "utf8" });
  if (validate.status !== 0) {
    console.error(`libmxr validate failed: ${name}`);
    console.error(validate.stdout);
    console.error(validate.stderr);
    failed += 1;
    continue;
  }
  console.log(`${name}: ${result.bytecode.length} B → libmxr ok`);
}

if (failed > 0) {
  console.error(`\n${failed} golden card(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${files.length} cards validated through libmxr`);
