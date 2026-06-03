import { describe, it, expect } from "vitest";
import {
  computeMonthlyPerformance,
  finalizeMonthlyPerformance,
  type MonthlyDealLine,
} from "../commission/engine";
import { LADDER, FLOORS } from "./fixtures";

function alwalaaLine(over: Partial<MonthlyDealLine> & { dealId: string }): MonthlyDealLine {
  return {
    attributionId: `attr-${over.dealId}`,
    dealValue: 60000,
    sharePct: 1,
    developerRate: 0.035,
    leadSource: "ALWALAA_SOURCED",
    attributionReason: "Alwalaa Leads",
    ...over,
  };
}

describe("computeMonthlyPerformance — whole-month retroactive tier", () => {
  it("applies the month tier to ALL closings (retroactive)", () => {
    // Two 60k deals -> 120k volume vs 100k target -> 120% -> Top (50%).
    const res = computeMonthlyPerformance({
      agentId: "a1",
      period: "2026-03",
      targetAmount: 100000,
      deals: [alwalaaLine({ dealId: "d1" }), alwalaaLine({ dealId: "d2" })],
      ladder: LADDER,
      floors: FLOORS,
    });

    expect(res.volumeClosed).toBe(120000);
    expect(res.pctOfTarget).toBeCloseTo(1.2, 10);
    expect(res.currentTier).toBe("Top");
    expect(res.currentSplitRate).toBe(0.5);
    // Both deals (incl. the first, which alone would be On Track) use 50%.
    expect(res.commissions.every((c) => c.agentSplitRate === 0.5)).toBe(true);
    // gross each 60000*0.035 = 2100; payout each 1050; projected 2100.
    expect(res.commissions.map((c) => c.agentPayout)).toEqual([1050, 1050]);
    expect(res.projectedPayout).toBe(2100);
    expect(res.alwalaaGrossMonth).toBe(4200);
    expect(res.dealCount).toBe(2);
  });
});

describe("provisional -> final transition", () => {
  const base = {
    agentId: "a1",
    period: "2026-03",
    targetAmount: 100000,
    deals: [alwalaaLine({ dealId: "d1" })],
    ladder: LADDER,
    floors: FLOORS,
  };

  it("is PROVISIONAL with no final payout by default", () => {
    const res = computeMonthlyPerformance(base);
    expect(res.status).toBe("PROVISIONAL");
    expect(res.finalPayout).toBeNull();
  });

  it("locks the projected payout into finalPayout when finalized", () => {
    const provisional = computeMonthlyPerformance(base);
    const final = finalizeMonthlyPerformance(provisional);
    expect(final.status).toBe("FINAL");
    expect(final.finalPayout).toBe(provisional.projectedPayout);
  });

  it("can compute directly in FINAL status", () => {
    const res = computeMonthlyPerformance({ ...base, status: "FINAL" });
    expect(res.status).toBe("FINAL");
    expect(res.finalPayout).toBe(res.projectedPayout);
  });
});

describe("multi-agent attribution (Decision 2)", () => {
  it("credits only the agent's share toward volume and payout", () => {
    const res = computeMonthlyPerformance({
      agentId: "a1",
      period: "2026-03",
      targetAmount: 100000,
      deals: [alwalaaLine({ dealId: "d1", dealValue: 100000, sharePct: 0.5 })],
      ladder: LADDER,
      floors: FLOORS,
    });
    expect(res.volumeClosed).toBe(50000); // 100k * 50% share
    expect(res.commissions[0].alwalaaGross).toBe(1750); // 50k * 3.5%
  });
});

describe("hybrid floor applied within a low-tier month", () => {
  it("floors agent-network deals at 50% while Alwalaa deals stay on the ladder", () => {
    // 20k volume vs 100k target -> 20% -> Recovery (25% ladder rate).
    const res = computeMonthlyPerformance({
      agentId: "a1",
      period: "2026-03",
      targetAmount: 100000,
      deals: [
        alwalaaLine({ dealId: "dA", dealValue: 10000 }), // Alwalaa -> 25%
        alwalaaLine({
          dealId: "dB",
          dealValue: 10000,
          leadSource: "AGENT_NETWORK",
          attributionReason: "My Own Lead",
        }),
      ],
      ladder: LADDER,
      floors: FLOORS,
    });

    expect(res.currentTier).toBe("Recovery");
    const byDeal = Object.fromEntries(res.commissions.map((c) => [c.dealId, c]));
    expect(byDeal.dA.agentSplitRate).toBe(0.25);
    expect(byDeal.dA.agentPayout).toBe(87.5); // 10000*0.035=350; *0.25
    expect(byDeal.dB.agentSplitRate).toBe(0.5); // floored
    expect(byDeal.dB.agentPayout).toBe(175); // 350 * 0.5
    expect(res.projectedPayout).toBe(262.5);
  });
});

describe("edge cases", () => {
  it("handles a zero-target agent without dividing by zero", () => {
    const res = computeMonthlyPerformance({
      agentId: "trainee",
      period: "2026-03",
      targetAmount: 0,
      deals: [alwalaaLine({ dealId: "d1" })],
      ladder: LADDER,
      floors: FLOORS,
    });
    expect(res.pctOfTarget).toBe(0);
    expect(res.currentTier).toBe("Recovery");
  });

  it("returns an empty month at zero volume", () => {
    const res = computeMonthlyPerformance({
      agentId: "a1",
      period: "2026-03",
      targetAmount: 100000,
      deals: [],
      ladder: LADDER,
      floors: FLOORS,
    });
    expect(res.volumeClosed).toBe(0);
    expect(res.projectedPayout).toBe(0);
    expect(res.dealCount).toBe(0);
  });
});
