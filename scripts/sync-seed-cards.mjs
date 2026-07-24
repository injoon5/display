#!/usr/bin/env node
/**
 * Keep convex/lib/seed.ts card `source` strings in sync with cards/<slug>.json.
 * The seed embeds each Stage 0 card as an escaped JSON string; this regenerates
 * those literals from the canonical card files so the two never drift.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = join(root, "cards");
const seedPath = join(root, "convex", "lib", "seed.ts");

let seed = readFileSync(seedPath, "utf8");
const files = readdirSync(cardsDir).filter((n) => n.endsWith(".json"));
let updated = 0;

for (const file of files) {
  const content = readFileSync(join(cardsDir, file), "utf8").trimEnd();
  const id = JSON.parse(content).id;
  const literal = JSON.stringify(content);
  // Match: source: "...<...\"id\": \"<id>\"...>",  (a JS string literal)
  const marker = `\\"id\\": \\"${id}\\"`;
  const re = new RegExp(`source: "((?:[^"\\\\]|\\\\.)*?${escapeRe(marker)}(?:[^"\\\\]|\\\\.)*?)"`, "s");
  if (!re.test(seed)) {
    console.error(`no seed source found for id=${id}`);
    process.exitCode = 1;
    continue;
  }
  seed = seed.replace(re, () => `source: ${literal}`);
  updated += 1;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

writeFileSync(seedPath, seed);
console.log(`synced ${updated} card source(s) into ${seedPath}`);
