import { describe, it, expect } from "vitest";
import { AnalysisInputSchema, SaveAnalysisSchema } from "./schema";
import { runInvestmentAnalysis } from "@/domain/realestate/investment/analyze";
import { clientSafeResult } from "@/lib/investReport";

const VALID_INPUT = {
  property: {
    project: "Al Mouj",
    reference: "AM-104",
    areaSqm: 120,
    completionStatus: "ready",
    askingPriceOmr: 150000,
    negotiatedPriceOmr: 145000,
  },
  acquisition: { costLines: [{ key: "legal", label: "Legal fees", amountOmr: 500 }] },
  strategies: { annual: { annualRentOmr: 12000, vacancyAllowancePct: 5, serviceChargeOmr: 1500 } },
  activeStrategy: "annual",
  financing: { mode: "mortgage", loanOmr: 100000, annualRatePct: 5.5, termYears: 20 },
  projection: { holdYears: 5, appreciationPct: 4 },
  objectives: { minNetYieldPct: 6 },
};

describe("AnalysisInputSchema", () => {
  it("accepts a well-formed input and it runs through the engine", () => {
    const parsed = AnalysisInputSchema.safeParse(VALID_INPUT);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const result = runInvestmentAnalysis(parsed.data);
      // 12000 − 600 vacancy = 11400 EGI; − 1500 service charge = 9900 NOI
      expect(result.activeStrategy.noiOmr).toBe(9900);
    }
  });

  it("rejects negative money, absurd magnitudes and bad enums", () => {
    expect(
      AnalysisInputSchema.safeParse({
        ...VALID_INPUT,
        property: { ...VALID_INPUT.property, askingPriceOmr: -5 },
      }).success,
    ).toBe(false);
    expect(
      AnalysisInputSchema.safeParse({
        ...VALID_INPUT,
        property: { ...VALID_INPUT.property, askingPriceOmr: 2_000_000_000 },
      }).success,
    ).toBe(false);
    expect(
      AnalysisInputSchema.safeParse({ ...VALID_INPUT, activeStrategy: "weekly" }).success,
    ).toBe(false);
  });

  it("rejects non-finite numbers (NaN/Infinity can never reach the engine)", () => {
    expect(
      AnalysisInputSchema.safeParse({
        ...VALID_INPUT,
        projection: { holdYears: Infinity },
      }).success,
    ).toBe(false);
  });

  it("caps holdYears at 30 and requires at least 1", () => {
    expect(
      AnalysisInputSchema.safeParse({ ...VALID_INPUT, projection: { holdYears: 31 } }).success,
    ).toBe(false);
    expect(
      AnalysisInputSchema.safeParse({ ...VALID_INPUT, projection: { holdYears: 0 } }).success,
    ).toBe(false);
  });

  it("requires seasonality to be exactly 12 months when present", () => {
    const bad = {
      ...VALID_INPUT,
      strategies: {
        daily: {
          adrOmr: 50,
          occupancyPct: 70,
          seasonality: [{ adrOmr: 50, occupancyPct: 70 }],
        },
      },
      activeStrategy: "daily",
    };
    expect(AnalysisInputSchema.safeParse(bad).success).toBe(false);
  });

  it("payment-plan fractions stay fractions (0–1), matching the calculators contract", () => {
    const ok = AnalysisInputSchema.safeParse({
      ...VALID_INPUT,
      financing: { mode: "payment_plan", plan: { downPct: 0.15, reservationPct: 0.05 } },
    });
    expect(ok.success).toBe(true);
    const bad = AnalysisInputSchema.safeParse({
      ...VALID_INPUT,
      financing: { mode: "payment_plan", plan: { downPct: 15 } }, // whole percent — wrong unit
    });
    expect(bad.success).toBe(false);
  });

  it("comparables require a data source and provenance (no unsourced comps)", () => {
    const bad = AnalysisInputSchema.safeParse({
      ...VALID_INPUT,
      comparables: [{ reference: "C1", project: "X", areaSqm: 100, askingPriceOmr: 90000 }],
    });
    expect(bad.success).toBe(false);
  });
});

describe("SaveAnalysisSchema", () => {
  it("requires a title and defaults status to saved", () => {
    const r = SaveAnalysisSchema.safeParse({ title: "AM-104 analysis", input: VALID_INPUT });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("saved");
    expect(SaveAnalysisSchema.safeParse({ input: VALID_INPUT }).success).toBe(false);
  });
});

describe("clientSafeResult", () => {
  it("strips negotiation strategy and internal warnings by construction", () => {
    const parsed = AnalysisInputSchema.parse(VALID_INPUT);
    const result = runInvestmentAnalysis(parsed);
    expect(result.offer).not.toBeNull(); // internal result carries the offer plan
    const safe = clientSafeResult(result);
    expect("offer" in safe).toBe(false);
    expect("warnings" in safe).toBe(false);
    // Everything a client may see survives
    expect(safe.metrics.netYieldPct).toBe(result.metrics.netYieldPct);
    expect(safe.qualification.status).toBe(result.qualification.status);
    // No INTERNAL commission fields exist anywhere in the engine result to
    // leak (leasing commission is a legitimate client-facing operating cost).
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/alwalaaGross|agentShare|agentSplit|developerRatePct/);
  });
});
