import { describe, it, expect } from "vitest";
import { resolveDeveloperRate } from "../commission/developerRate";
import type { DeveloperRateRule } from "../types";

const FLAT: DeveloperRateRule[] = [{ minQuarterlyVolume: 0, maxQuarterlyVolume: null, rate: 0.035 }];

const TIERED: DeveloperRateRule[] = [
  { tierName: "T1", minQuarterlyVolume: 0, maxQuarterlyVolume: 500000, rate: 0.03 },
  { tierName: "T2", minQuarterlyVolume: 500000, maxQuarterlyVolume: 1000000, rate: 0.035 },
  { tierName: "T3", minQuarterlyVolume: 1000000, maxQuarterlyVolume: null, rate: 0.04 },
];

describe("resolveDeveloperRate", () => {
  it("returns the flat rate for any volume when seeded flat", () => {
    expect(resolveDeveloperRate(0, FLAT)).toBe(0.035);
    expect(resolveDeveloperRate(9_999_999, FLAT)).toBe(0.035);
  });

  it("resolves tier boundaries (min inclusive, max exclusive)", () => {
    expect(resolveDeveloperRate(0, TIERED)).toBe(0.03);
    expect(resolveDeveloperRate(499_999, TIERED)).toBe(0.03);
    expect(resolveDeveloperRate(500_000, TIERED)).toBe(0.035);
    expect(resolveDeveloperRate(999_999, TIERED)).toBe(0.035);
    expect(resolveDeveloperRate(1_000_000, TIERED)).toBe(0.04);
    expect(resolveDeveloperRate(5_000_000, TIERED)).toBe(0.04);
  });

  it("throws when no rule exists", () => {
    expect(() => resolveDeveloperRate(100, [])).toThrow(/No DeveloperCommissionRule/);
  });
});
