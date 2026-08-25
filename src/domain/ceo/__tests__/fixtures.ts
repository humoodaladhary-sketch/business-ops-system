// Loads the real seed files and the real 2026 deal book from disk. The tests
// run against the same data the application ships with — a fixture that drifts
// from the seed is a test that proves nothing.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadDataset } from "../seed";
import type { CeoDataset } from "../types";

function readData(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../../data/ceo/${name}`, import.meta.url)), "utf8");
}

let cached: CeoDataset | null = null;

/** The shipped dataset: 12 people, 38 deals, two cost policies. */
export function dataset(): CeoDataset {
  if (!cached) {
    cached = loadDataset({
      peopleJson: JSON.parse(readData("people.json")),
      costPoliciesJson: JSON.parse(readData("cost-policies.json")),
      settingsJson: JSON.parse(readData("settings.json")),
      provisionsJson: JSON.parse(readData("provisions.json")),
      dealsCsv: readData("deals-2026.csv"),
    });
  }
  return cached;
}

export function personById(id: string) {
  const person = dataset().people.find((p) => p.id === id);
  if (!person) throw new Error(`No person ${id} in the seed.`);
  return person;
}

/** The date the verified table is measured to. */
export const AS_OF = "2026-08-25";
export const WINDOW = { from: "2026-01", to: "2026-08" } as const;
