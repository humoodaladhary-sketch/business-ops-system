import { describe, it, expect } from "vitest";
import { milestonesReached, nextMilestone, computeNextTierNudge, computePace } from "../kpi";
import { LADDER } from "./fixtures";

describe("milestones", () => {
  it("reports reached milestones", () => {
    expect(milestonesReached(0.55)).toEqual([0.1, 0.3, 0.5]);
    expect(milestonesReached(1.0)).toEqual([0.1, 0.3, 0.5, 0.7, 0.9, 1.0]);
  });
  it("reports the next milestone", () => {
    expect(nextMilestone(0.55)).toBe(0.7);
    expect(nextMilestone(1.0)).toBeNull();
  });
});

describe("computeNextTierNudge (signature widget)", () => {
  it("quantifies the climb to the next tier and the extra payout", () => {
    // 72% of a 100k target, currently On Track (35%). Next: Strong (40%).
    const nudge = computeNextTierNudge({
      volumeClosed: 72000,
      targetAmount: 100000,
      ladder: LADDER,
      alwalaaGrossMonth: 10000,
    });
    expect(nudge.hasNext).toBe(true);
    expect(nudge.currentTierName).toBe("On Track");
    expect(nudge.nextTierName).toBe("Strong");
    expect(nudge.amountToNextTier).toBe(8000); // 80% of 100k - 72k
    expect(nudge.extraPayoutEstimate).toBe(500); // 10000 * (0.40 - 0.35)
  });

  it("reports no next tier at the top", () => {
    const nudge = computeNextTierNudge({
      volumeClosed: 130000,
      targetAmount: 100000,
      ladder: LADDER,
      alwalaaGrossMonth: 10000,
    });
    expect(nudge.hasNext).toBe(false);
    expect(nudge.currentTierName).toBe("Top");
  });
});

describe("computePace (Thursday check)", () => {
  it("is on pace at the linear midpoint", () => {
    const p = computePace({ volumeClosed: 50000, targetAmount: 100000, dayOfMonth: 15, daysInMonth: 30 });
    expect(p.aheadOfPace).toBe(true);
    expect(p.gapToPace).toBe(0);
  });
  it("is behind pace when volume lags days elapsed", () => {
    const p = computePace({ volumeClosed: 40000, targetAmount: 100000, dayOfMonth: 20, daysInMonth: 30 });
    expect(p.aheadOfPace).toBe(false);
    expect(p.gapToPace).toBeGreaterThan(0);
  });
});
