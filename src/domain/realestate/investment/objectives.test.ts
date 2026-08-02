import { describe, it, expect } from "vitest";
import { qualify, type QualificationInputs } from "./objectives";

const BASE: QualificationInputs = {
  grossYieldPct: 8.28,
  netYieldPct: 6.21,
  cashOnCashPct: 7.5,
  irrPct: 11.4,
  dscr: 1.09,
  ltvPct: 68.97,
  paybackYears: 9.2,
  monthlyCashFlowOmr: 375,
  annualIncomeOmr: 11400,
  totalCashRequiredOmr: 52000,
  valueCagrPct: 3,
  residencyTier: "investor_2yr",
  completionStatus: "ready",
  breakEvenOccupancyPct: 62,
  dataQualityScore: 78,
};

describe("qualify — classification", () => {
  it("meets when every stated criterion passes", () => {
    const r = qualify(BASE, { minNetYieldPct: 6, minDscr: 1.05, maxLtvPct: 70 });
    expect(r.status).toBe("meets");
    expect(r.passed).toEqual(["netYield", "dscr", "ltv"]);
    expect(r.failed).toEqual([]);
    expect(r.recommendedAction).toContain("offer");
  });

  it("partially meets on a mix of pass and fail, with distances", () => {
    const r = qualify(BASE, { minNetYieldPct: 6, minIrrPct: 15 });
    expect(r.status).toBe("partially_meets");
    const irr = r.criteria.find((c) => c.key === "irr")!;
    expect(irr.status).toBe("fail");
    expect(irr.distance).toBe(-3.6); // 11.4 − 15
    expect(irr.distancePct).toBe(-24); // −3.6/15
    const net = r.criteria.find((c) => c.key === "netYield")!;
    expect(net.status).toBe("pass");
    expect(net.distance).toBe(0.21);
  });

  it("does not meet when every evaluable criterion fails", () => {
    const r = qualify(BASE, { minNetYieldPct: 9, minCashOnCashPct: 12 });
    expect(r.status).toBe("does_not_meet");
    expect(r.recommendedAction).toContain("Reject");
  });

  it("insufficient data when no criteria are set", () => {
    const r = qualify(BASE, {});
    expect(r.status).toBe("insufficient_data");
    expect(r.score).not.toBeNull(); // score still computable from metrics
  });

  it("null metrics become UNKNOWN criteria — never silent passes", () => {
    const r = qualify({ ...BASE, irrPct: null }, { minIrrPct: 10, minNetYieldPct: 6 });
    expect(r.status).toBe("partially_meets"); // evaluable passed, one unknown
    expect(r.unknown).toEqual(["irr"]);
    expect(r.missingData).toEqual(["IRR"]);
    expect(r.recommendedAction).toContain("Verify");
  });

  it("all-unknown criteria collapse to insufficient_data", () => {
    const r = qualify({ ...BASE, irrPct: null, dscr: null }, { minIrrPct: 10, minDscr: 1.2 });
    expect(r.status).toBe("insufficient_data");
  });

  it("max-direction criteria: LTV and initial cash", () => {
    const r = qualify(BASE, { maxLtvPct: 60, maxInitialCashOmr: 50000 });
    expect(r.status).toBe("does_not_meet");
    const ltv = r.criteria.find((c) => c.key === "ltv")!;
    expect(ltv.distance).toBe(-8.97); // 60 − 68.97
    const cash = r.criteria.find((c) => c.key === "initialCash")!;
    expect(cash.distance).toBe(-2000);
  });

  it("residency tier ranks upward (golden covers investor requirement)", () => {
    const gold = qualify({ ...BASE, residencyTier: "golden_10yr" }, { requiredResidencyTier: "investor_2yr" });
    expect(gold.criteria[0].status).toBe("pass");
    const below = qualify({ ...BASE, residencyTier: "none" }, { requiredResidencyTier: "investor_2yr" });
    expect(below.criteria[0].status).toBe("fail");
  });

  it("completion requirement fails an off-plan unit when ready is required", () => {
    const r = qualify({ ...BASE, completionStatus: "off_plan" }, { requiredCompletion: "ready" });
    expect(r.status).toBe("does_not_meet");
  });
});

describe("qualify — score and confidence", () => {
  it("weighted score is explainable through categories", () => {
    const r = qualify(BASE, { minNetYieldPct: 6 });
    expect(r.score).not.toBeNull();
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    const cats = Object.fromEntries(r.categories.map((c) => [c.key, c]));
    // net yield 6.21 on a 0–8 scale = 77.6
    expect(Math.round(cats.incomeReturn.score!)).toBe(78);
    // data quality passes straight through
    expect(cats.dataQuality.score).toBe(78);
    // weights configurable: all weight on data quality → score = 78
    const custom = qualify(BASE, {}, { dataQuality: 100 });
    expect(custom.score).toBe(78);
  });

  it("unlevered deals score financing at 100 (no debt risk)", () => {
    const r = qualify({ ...BASE, dscr: null }, {});
    expect(r.categories.find((c) => c.key === "financing")!.score).toBe(100);
  });

  it("confidence drops with unknowns and poor data quality", () => {
    const high = qualify(BASE, { minNetYieldPct: 6 });
    expect(high.confidence).toBe("high");
    const low = qualify({ ...BASE, dataQualityScore: 30 }, { minNetYieldPct: 6 });
    expect(low.confidence).toBe("low");
    const med = qualify({ ...BASE, dataQualityScore: 60 }, { minNetYieldPct: 6 });
    expect(med.confidence).toBe("medium");
  });

  it("negative cash flow is surfaced as a negative factor", () => {
    const r = qualify({ ...BASE, monthlyCashFlowOmr: -150 }, { minNetYieldPct: 6 });
    expect(r.negatives.some((n) => n.includes("Negative monthly cash flow"))).toBe(true);
  });
});
