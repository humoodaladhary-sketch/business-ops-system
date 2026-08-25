import { describe, it, expect } from "vitest";
import {
  applyAdjustments,
  runInvestmentAnalysis,
  FORMULA_VERSION,
  type InvestmentAnalysisInput,
} from "./analyze";

/**
 * Reference fixture (mirrors the feature spec's example contract):
 * ITC unit, 120 m², asking 150,000, negotiated 145,000.
 * Annual strategy: rent 12,000, vacancy 5% → EGI 11,400;
 * opex = 1,500 service + 100 insurance + 800 maintenance = 2,400 → NOI 9,000.
 * Mortgage 100,000 @ 5.5% / 20y monthly.
 */
const FIXTURE: InvestmentAnalysisInput = {
  property: {
    name: "Marina View 104",
    project: "Al Mouj",
    developer: "Al Mouj Muscat",
    reference: "AM-104",
    unitType: "2BR Apartment",
    bedrooms: 2,
    areaSqm: 120,
    completionStatus: "ready",
    category: "ITC",
    ownershipEligibility: "all_nationalities",
    askingPriceOmr: 150000,
    negotiatedPriceOmr: 145000,
    dataSource: "Live inventory AM-104",
    verifiedAt: "2026-08-01",
  },
  acquisition: {
    costLines: [
      { key: "registration", label: "Registration fee (3%)", amountOmr: 4350 },
      { key: "legal", label: "Legal fees", amountOmr: 500 },
    ],
  },
  strategies: {
    annual: {
      annualRentOmr: 12000,
      vacancyAllowancePct: 5,
      serviceChargeOmr: 1500,
      insuranceOmr: 100,
      maintenanceOmr: 800,
    },
  },
  activeStrategy: "annual",
  financing: {
    mode: "mortgage",
    loanOmr: 100000,
    annualRatePct: 5.5,
    termYears: 20,
  },
  projection: {
    holdYears: 5,
    appreciationPct: 4,
    sellingCostsPct: 3,
    discountRatePct: 8,
  },
  objectives: {
    minNetYieldPct: 6,
    minDscr: 1.05,
    maxLtvPct: 75,
  },
};

describe("runInvestmentAnalysis — reference fixture", () => {
  const r = runInvestmentAnalysis(FIXTURE);

  it("stamps version and currency and runs at the negotiated price", () => {
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
    expect(r.currency).toBe("OMR");
    expect(r.analysisPriceOmr).toBe(145000);
  });

  it("reproduces the reference income figures", () => {
    expect(r.activeStrategy.grossPotentialIncomeOmr).toBe(12000);
    expect(r.activeStrategy.vacancyLossOmr).toBe(600);
    expect(r.activeStrategy.effectiveGrossIncomeOmr).toBe(11400);
    expect(r.activeStrategy.operatingExpensesOmr).toBe(2400);
    expect(r.activeStrategy.noiOmr).toBe(9000);
  });

  it("reproduces the reference headline metrics", () => {
    expect(r.metrics.grossYieldPct).toBe(8.28); // 12000/145000
    expect(r.metrics.netYieldPct).toBe(6.21); // 9000/145000
    expect(r.metrics.ltvPct).toBe(68.97); // 100000/145000
    expect(r.metrics.dscr).toBe(1.09); // 9000 / (687.86×12 = 8254.32)
    expect(r.metrics.operatingExpenseRatioPct).toBe(21.05); // 2400/11400
    // acquisition: 145000 + 4850 = 149850; cash = 149850 − 100000
    expect(r.acquisition.totalAcquisitionCostOmr).toBe(149850);
    expect(r.acquisition.totalCashRequiredOmr).toBe(49850);
    expect(r.acquisition.pricePerSqmOmr).toBe(1208.333);
  });

  it("projects, exits and derives IRR/NPV/equity multiple deterministically", () => {
    expect(r.projection.periods).toHaveLength(5);
    // value CAGR recovers the 4% appreciation input
    expect(r.projection.valueCagrPct).toBe(4);
    expect(r.projection.exit.method).toBe("appreciation");
    expect(r.projection.irrPct).not.toBeNull();
    expect(r.projection.equityMultiple).not.toBeNull();
    // determinism: same input → identical result
    const again = runInvestmentAnalysis(FIXTURE);
    expect(again.projection.irrPct).toBe(r.projection.irrPct);
    expect(again.metrics).toEqual(r.metrics);
  });

  it("qualifies against the stated objectives with pass details", () => {
    expect(r.qualification.status).toBe("meets");
    expect(r.qualification.passed).toEqual(["netYield", "dscr", "ltv"]);
    expect(r.qualification.score).not.toBeNull();
    expect(r.qualification.confidence).toBe("high");
  });

  it("solves the offer range from the objectives (net yield binds)", () => {
    expect(r.offer).not.toBeNull();
    const justified = r.offer!.maximumJustifiedPriceOmr;
    // minNetYield 6% → price ≤ 9000/0.06 = 150000 (gross of solver rounding)
    expect(justified).not.toBeNull();
    expect(Math.abs((justified as number) - 150000)).toBeLessThanOrEqual(200);
    expect(r.offer!.suggestedRange).not.toBeNull();
    expect(r.offer!.walkAwayPriceOmr).toBe(justified);
    expect(r.offer!.disclaimer).toContain("not a market valuation");
  });

  it("runs the three scenario presets plus sensitivity with ranked impact", () => {
    expect(r.scenarios.map((s) => s.definition.key)).toEqual(["conservative", "base", "optimistic"]);
    const base = r.scenarios.find((s) => s.definition.key === "base")!;
    expect(base.outcome.irrPct).toBe(r.projection.irrPct); // base = untouched input
    const conservative = r.scenarios.find((s) => s.definition.key === "conservative")!;
    expect(conservative.outcome.irrPct as number).toBeLessThan(base.outcome.irrPct as number);
    const optimistic = r.scenarios.find((s) => s.definition.key === "optimistic")!;
    expect(optimistic.outcome.irrPct as number).toBeGreaterThan(base.outcome.irrPct as number);

    expect(r.sensitivity).not.toBeNull();
    expect(r.sensitivity!.ranked.length).toBeGreaterThan(0);
    expect(r.sensitivity!.ranked[0].impact).not.toBeNull();
  });

  it("explains every headline calculation with formula, inputs and steps", () => {
    const metrics = r.explains.map((e) => e.metric);
    expect(metrics).toContain("Net operating income");
    expect(metrics).toContain("Gross rental yield");
    expect(metrics).toContain("DSCR");
    expect(metrics).toContain("IRR");
    const noi = r.explains.find((e) => e.metric === "Net operating income")!;
    expect(noi.formula).toBe("effective gross income − operating expenses");
    expect(noi.steps[0]).toBe("11400 − 2400 = 9000 OMR");
    expect(noi.result).toBe(9000);
  });

  it("tracks data quality from the auto-derived provenance", () => {
    expect(r.dataQuality.score).toBeGreaterThan(0);
    expect(r.dataQuality.verifiedFields).toContain("askingPriceOmr"); // has dataSource
    expect(r.dataQuality.assumedFields).toContain("rentAssumptions");
  });
});

describe("runInvestmentAnalysis — modes and edge cases", () => {
  it("cash purchase: no debt metrics, cash = full acquisition cost", () => {
    const r = runInvestmentAnalysis({
      ...FIXTURE,
      financing: { mode: "cash" },
    });
    expect(r.metrics.dscr).toBeNull();
    expect(r.metrics.ltvPct).toBeNull();
    expect(r.metrics.annualDebtServiceOmr).toBe(0);
    expect(r.acquisition.totalCashRequiredOmr).toBe(149850);
    expect(r.metrics.cashOnCashPct).toBe(6.01); // 9000/149850
  });

  it("payment plan: instalments become scheduled outflows; cash-on-cash uses total cash", () => {
    const r = runInvestmentAnalysis({
      ...FIXTURE,
      property: { ...FIXTURE.property, completionStatus: "off_plan", handoverMonths: 24 },
      financing: {
        mode: "payment_plan",
        plan: { reservationPct: 0.05, downPct: 0.15, years: 2, installmentsPerYear: 4 },
      },
      projection: { ...FIXTURE.projection, holdYears: 6 },
    });
    expect(r.financing.scheduledOutflows.length).toBeGreaterThan(0);
    // Pre-handover years have no income
    expect(r.projection.periods[0].rentalIncomeOmr).toBe(0);
    expect(r.projection.periods[1].rentalIncomeOmr).toBe(0);
    expect(r.projection.periods[2].rentalIncomeOmr).toBe(11400);
    // All price instalments + acquisition extras are cash in
    expect(r.projection.totalCashInOmr).toBe(145000 + 4850);
  });

  it("lender fees join the cash requirement (never silently dropped)", () => {
    const withFees = runInvestmentAnalysis({
      ...FIXTURE,
      financing: { ...FIXTURE.financing, mortgageFeesOmr: 1000 },
    });
    const without = runInvestmentAnalysis(FIXTURE);
    expect(withFees.acquisition.totalCashRequiredOmr).toBe(without.acquisition.totalCashRequiredOmr + 1000);
    expect(withFees.acquisition.lines.some((l) => l.key === "lenderFees")).toBe(true);
    // More cash in → lower cash-on-cash
    expect(withFees.metrics.cashOnCashPct as number).toBeLessThan(without.metrics.cashOnCashPct as number);
  });

  it("early exit from a payment plan settles the remaining instalments (no phantom profit)", () => {
    const r = runInvestmentAnalysis({
      ...FIXTURE,
      property: { ...FIXTURE.property, completionStatus: "off_plan", handoverMonths: 36 },
      strategies: {},
      activeStrategy: "annual",
      objectives: undefined,
      financing: {
        mode: "payment_plan",
        plan: { reservationPct: 0.05, downPct: 0.15, years: 5, installmentsPerYear: 4 },
      },
      projection: { holdYears: 2, appreciationPct: 0, sellingCostsPct: 0, discountRatePct: 8 },
    });
    expect(r.projection.exit.remainingPlanObligationOmr).toBeGreaterThan(0);
    // No rent, flat price: profit is bounded by the acquisition extras, never a windfall
    expect(r.projection.totalProfitOmr).toBeLessThanOrEqual(0);
  });

  it("cash deals pass a max-LTV objective (0% leverage, not unknown)", () => {
    const r = runInvestmentAnalysis({
      ...FIXTURE,
      financing: { mode: "cash" },
      objectives: { maxLtvPct: 70 },
    });
    const ltv = r.qualification.criteria.find((c) => c.key === "ltv")!;
    expect(ltv.status).toBe("pass");
    expect(ltv.actual).toBe(0);
  });

  it("no strategy configured: warns and keeps figures at zero (no invention)", () => {
    const r = runInvestmentAnalysis({
      ...FIXTURE,
      strategies: {},
      activeStrategy: "annual",
      objectives: undefined,
    });
    expect(r.warnings.some((w) => w.includes("No rental strategy"))).toBe(true);
    expect(r.activeStrategy.noiOmr).toBe(0);
    expect(r.qualification.status).toBe("insufficient_data");
  });

  it("blended strategy weights daily and annual by share", () => {
    const r = runInvestmentAnalysis({
      ...FIXTURE,
      strategies: {
        ...FIXTURE.strategies,
        daily: { adrOmr: 45, occupancyPct: 65 },
        blendSharesPct: { daily: 40, annual: 60 },
      },
      activeStrategy: "blended",
    });
    expect(r.activeStrategy.strategy).toBe("blended");
    // three results: daily, annual, blended
    expect(r.strategies).toHaveLength(3);
  });

  it("zero asking price stays honest: null yields, insufficient data", () => {
    const r = runInvestmentAnalysis({
      ...FIXTURE,
      property: { ...FIXTURE.property, askingPriceOmr: 0, negotiatedPriceOmr: null },
      financing: { mode: "cash" },
      objectives: { minNetYieldPct: 6 },
    });
    expect(r.metrics.grossYieldPct).toBeNull();
    expect(r.metrics.netYieldPct).toBeNull();
    expect(r.qualification.status).toBe("insufficient_data");
  });
});

describe("applyAdjustments", () => {
  it("adjusts rent, occupancy, expenses, rate, price, hold and handover", () => {
    const adj = applyAdjustments(FIXTURE, {
      rentDeltaPct: -10,
      occupancyDeltaPts: -10,
      expensesDeltaPct: 20,
      interestDeltaPts: 1,
      priceDeltaPct: -5,
      holdDeltaYears: 2,
      completionDelayMonths: 6,
    });
    expect(adj.strategies.annual!.annualRentOmr).toBe(10800);
    // occupancy −10 pts → vacancy allowance 5 + 10 = 15
    expect(adj.strategies.annual!.vacancyAllowancePct).toBe(15);
    expect(adj.strategies.annual!.serviceChargeOmr).toBe(1800); // ×1.2
    expect(adj.financing.annualRatePct).toBe(6.5);
    expect(adj.property.negotiatedPriceOmr).toBe(137750); // 145000 × 0.95
    expect(adj.projection.holdYears).toBe(7);
    expect(adj.property.handoverMonths).toBe(6);
    expect(adj.lean).toBe(true);
  });

  it("clamps occupancy shifts into 0–100 and hold into 1–30", () => {
    const adj = applyAdjustments(FIXTURE, { occupancyDeltaPts: 50, holdDeltaYears: -20 });
    expect(adj.strategies.annual!.vacancyAllowancePct).toBe(0); // 5 − 50 → clamp 0
    expect(adj.projection.holdYears).toBe(1);
  });

  it("does not mutate the base input", () => {
    const before = JSON.stringify(FIXTURE);
    applyAdjustments(FIXTURE, { rentDeltaPct: -50, expensesDeltaPct: 99 });
    expect(JSON.stringify(FIXTURE)).toBe(before);
  });
});
