import type { DeveloperRateRule } from "../types";

/**
 * Resolve the developer→Alwalaa commission rate from cumulative quarterly
 * volume with that developer (Decision 4). Seeded flat today (a single rule
 * with minQuarterlyVolume 0), but the resolver already supports tiers.
 */
export function resolveDeveloperRate(quarterlyVolume: number, rules: DeveloperRateRule[]): number {
  if (rules.length === 0) {
    throw new Error("No DeveloperCommissionRule available for developer");
  }
  const sorted = [...rules].sort((a, b) => a.minQuarterlyVolume - b.minQuarterlyVolume);

  let match = sorted.find(
    (r) =>
      quarterlyVolume >= r.minQuarterlyVolume &&
      (r.maxQuarterlyVolume === null || quarterlyVolume < r.maxQuarterlyVolume),
  );

  if (!match) {
    match =
      quarterlyVolume < sorted[0].minQuarterlyVolume ? sorted[0] : sorted[sorted.length - 1];
  }

  return match.rate;
}
