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

const CEO_DATA_DIR = ["data", "ceo"] as const;

export class CeoDataError extends Error {}

let cache: { dataset: CeoDataset; loadedAt: number; fingerprint: string } | null = null;

function readDataFiles(): {
  peopleJson: unknown;
  costPoliciesJson: unknown;
  settingsJson: unknown;
  provisionsJson: unknown;
  dealsCsv: string;
  fingerprint: string;
} {
  const dir = join(process.cwd(), ...CEO_DATA_DIR);
  const read = (name: string): string => {
    try {
      return readFileSync(join(dir, name), "utf8");
    } catch (e) {
      throw new CeoDataError(
        `Could not read ${join(...CEO_DATA_DIR, name)} — the CEO dataset is not available in this ` +
          `deployment. (${(e as Error).message})`,
      );
    }
  };
  const files = {
    people: read("people.json"),
    costPolicies: read("cost-policies.json"),
    settings: read("settings.json"),
    provisions: read("provisions.json"),
    deals: read("deals-2026.csv"),
  };
  const parse = (name: string, text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new CeoDataError(`${name} is not valid JSON: ${(e as Error).message}`);
    }
  };
  return {
    peopleJson: parse("people.json", files.people),
    costPoliciesJson: parse("cost-policies.json", files.costPolicies),
    settingsJson: parse("settings.json", files.settings),
    provisionsJson: parse("provisions.json", files.provisions),
    dealsCsv: files.deals,
    // Cheap change-detector: total length of every source file.
    fingerprint: Object.values(files).map((t) => t.length).join(":"),
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
