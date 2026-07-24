#!/usr/bin/env node
/**
 * Regenerate the `seedCards` array in convex/lib/seed.ts from the canonical
 * cards/*.card (MXML) files, so the deployed demo matches the catalogue. The
 * icon-sheet reference card is excluded.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = join(root, "cards");
const seedPath = join(root, "convex", "lib", "seed.ts");

const EXCLUDE = new Set(["iconsheet"]);
const DWELL = { clock: 10000, "clock-dim": 15000, "now-playing": 12000, bus: 12000 };

const files = readdirSync(cardsDir).filter((n) => n.endsWith(".card")).sort();
const entries = [];
for (const file of files) {
  const src = readFileSync(join(cardsDir, file), "utf8").trimEnd();
  const idm = src.match(/<card\s+id="([^"]+)"\s+name="([^"]+)"\s+priority="(\d+)"/);
  if (!idm) { console.error(`skip ${file}: no card header`); continue; }
  const [, id, name, priority] = idm;
  if (EXCLUDE.has(id)) continue;
  const dwellMs = DWELL[id] ?? 9000;
  entries.push({ slug: id, name, priority: Number(priority), dwellMs, source: src });
}

const body = entries
  .map((e) => `  {\n    slug: ${JSON.stringify(e.slug)},\n    name: ${JSON.stringify(e.name)},\n    priority: ${e.priority},\n    dwellMs: ${e.dwellMs},\n    source: ${JSON.stringify(e.source)},\n  },`)
  .join("\n");

let seed = readFileSync(seedPath, "utf8");
const startMarker = "const seedCards: SeedCardInput[] = [";
const start = seed.indexOf(startMarker);
if (start < 0) throw new Error("seedCards array not found");
const end = seed.indexOf("\n];", start);
if (end < 0) throw new Error("seedCards end not found");
seed = seed.slice(0, start) + `${startMarker}\n${body}\n]` + seed.slice(end + 2);
writeFileSync(seedPath, seed);
console.log(`wrote ${entries.length} cards into seed.ts`);
