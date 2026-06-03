import { describe, it, expect } from "vitest";
import { resolveLadderTier, nextLadderTier } from "../commission/ladder";
import { LADDER } from "./fixtures";

describe("resolveLadderTier — every tier boundary", () => {
  const cases: Array<[number, string, number]> = [
    [0.0, "Recovery", 0.25],
    [0.4999, "Recovery", 0.25],
    [0.5, "On Track", 0.35], // min inclusive
    [0.7999, "On Track", 0.35],
    [0.8, "Strong", 0.4], // min inclusive
    [0.9999, "Strong", 0.4],
    [1.0, "Top", 0.5], // min inclusive, open-ended top
    [1.5, "Top", 0.5],
    [2.0, "Top", 0.5],
  ];

  it.each(cases)("pct %f -> %s (%f)", (pct, tierName, rate) => {
    const r = resolveLadderTier(pct, LADDER);
    expect(r.tierName).toBe(tierName);
    expect(r.agentSplitRate).toBe(rate);
  });

  it("handles negative pct by snapping to the lowest tier", () => {
    expect(resolveLadderTier(-0.2, LADDER).tierName).toBe("Recovery");
  });

  it("is order-independent (unsorted ladder input)", () => {
    const shuffled = [LADDER[3], LADDER[1], LADDER[0], LADDER[2]];
    expect(resolveLadderTier(0.85, shuffled).tierName).toBe("Strong");
  });

  it("throws on an empty ladder", () => {
    expect(() => resolveLadderTier(0.5, [])).toThrow(/empty/i);
  });
});

describe("nextLadderTier", () => {
  it("returns the next rung above the current pct", () => {
    expect(nextLadderTier(0.72, LADDER)?.tierName).toBe("Strong");
    expect(nextLadderTier(0.0, LADDER)?.tierName).toBe("On Track");
  });
  it("returns null at the top tier", () => {
    expect(nextLadderTier(1.2, LADDER)).toBeNull();
  });
});
