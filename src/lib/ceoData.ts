// Runtime access to the CEO Command Center dataset.
//
// The dataset is read from `data/ceo/` on every request (behind a short cache),
// so it is live in the sense that matters: when the seed files change, the next
// answer changes. Nothing is snapshotted into a prompt and nothing is baked in
// at build time — every figure the copilot quotes is recomputed from the current
// source of record by `@/lib/calc`.
//
// This is file-backed rather than database-backed today. When the CEO schema
// lands, only `readDataFiles` changes; every caller and every tool stays put.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadDataset, type CeoDataset } from "@/lib/calc";

/** How long a parsed dataset is reused before the files are read again. */
export const CEO_DATA_TTL_MS = 15_000;

export class CeoDataError extends Error {}

/**
 * Read one data file.
 *
 * Every call site below passes a literal path built from `process.cwd()` in a
 * single expression. That is load-bearing, not style:
 *
 *   - Literal paths let the build's file tracer resolve them statically, so the
 *     five data files ship with the copilot function automatically. No
 *     `outputFileTracingIncludes` entry is needed, and none should be added.
 *   - A path assembled from a variable is opaque to the tracer, which
 *     compensates by sweeping the entire repository root — `.git` objects and
 *     the build output included — into EVERY serverless function. That is not
 *     hypothetical: it took the largest function from 17 MB to 442 MB and failed
 *     a Vercel deploy against the 250 MB limit.
 *
 * If you add a file here, add it as another literal line.
 */
function read(absolutePath: string, label: string): string {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch (e) {
    throw new CeoDataError(
      `Could not read ${label} — the CEO dataset is not available in this deployment. ` +
        `(${(e as Error).message})`,
    );
  }
}

function parse(label: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new CeoDataError(`${label} is not valid JSON: ${(e as Error).message}`);
  }
}

let cache: { dataset: CeoDataset; loadedAt: number; fingerprint: string } | null = null;

function readDataFiles(): {
  peopleJson: unknown;
  costPoliciesJson: unknown;
  settingsJson: unknown;
  provisionsJson: unknown;
  dealsCsv: string;
  fingerprint: string;
} {
  const people = read(join(process.cwd(), "data/ceo/people.json"), "data/ceo/people.json");
  const costPolicies = read(join(process.cwd(), "data/ceo/cost-policies.json"), "data/ceo/cost-policies.json");
  const settings = read(join(process.cwd(), "data/ceo/settings.json"), "data/ceo/settings.json");
  const provisions = read(join(process.cwd(), "data/ceo/provisions.json"), "data/ceo/provisions.json");
  const deals = read(join(process.cwd(), "data/ceo/deals-2026.csv"), "data/ceo/deals-2026.csv");

  return {
    peopleJson: parse("data/ceo/people.json", people),
    costPoliciesJson: parse("data/ceo/cost-policies.json", costPolicies),
    settingsJson: parse("data/ceo/settings.json", settings),
    provisionsJson: parse("data/ceo/provisions.json", provisions),
    dealsCsv: deals,
    // Cheap change-detector: total length of every source file.
    fingerprint: [people, costPolicies, settings, provisions, deals].map((t) => t.length).join(":"),
  };
}

/**
 * The current dataset. Re-reads the files when the cache has expired, and
 * re-parses only when their content actually changed.
 */
export function loadCeoDataset(opts: { force?: boolean; now?: number } = {}): CeoDataset {
  const now = opts.now ?? Date.now();
  if (!opts.force && cache && now - cache.loadedAt < CEO_DATA_TTL_MS) return cache.dataset;

  const raw = readDataFiles();
  if (cache && cache.fingerprint === raw.fingerprint) {
    cache = { ...cache, loadedAt: now };
    return cache.dataset;
  }
  const dataset = loadDataset(raw);
  cache = { dataset, loadedAt: now, fingerprint: raw.fingerprint };
  return dataset;
}

/** Drop the cache — used by tests and after an import writes new data. */
export function clearCeoDatasetCache(): void {
  cache = null;
}

/** Today in Asia/Muscat (UTC+4, no DST), as `YYYY-MM-DD`. */
export function todayInMuscat(now: Date = new Date()): string {
  return new Date(now.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
}
