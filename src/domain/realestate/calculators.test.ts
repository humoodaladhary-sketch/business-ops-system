import { describe, it, expect } from "vitest";
import {
  grossAndNetYield,
  capitalAppreciation,
  paymentPlan,
  mortgageMonthly,
  residencyTier,
  commissionBreakdown,
  omrToUsd,
} from "./calculators";

describe("grossAndNetYield", () => {
  it("computes gross/net yield and net income", () => {
    const r = grossAndNetYield({ priceOmr: 100000, annualRentOmr: 7000, annualCostsOmr: 1500 });
    expect(r.grossYieldPct).toBe(7);
    expect(r.annualNetOmr).toBe(5500);
    expect(r.netYieldPct).toBe(5.5);
  });

  it("guards a zero price (no divide-by-zero)", () => {
    const r = grossAndNetYield({ priceOmr: 0, annualRentOmr: 7000, annualCostsOmr: 1500 });
    expect(r.grossYieldPct).toBe(0);
    expect(r.netYieldPct).toBe(0);
    expect(r.annualNetOmr).toBe(5500);
  });
});

describe("capitalAppreciation", () => {
  it("compounds growth and reports gain + CAGR", () => {
    const r = capitalAppreciation({ priceOmr: 100000, annualGrowthPct: 5, years: 3 });
    // 100000 * 1.05^3 = 115762.5
    expect(r.projectedValueOmr).toBe(115762.5);
    expect(r.totalGainOmr).toBe(15762.5);
    // constant-growth CAGR equals the input rate
    expect(r.cagrPct).toBe(5);
  });

  it("guards zero years", () => {
    const r = capitalAppreciation({ priceOmr: 100000, annualGrowthPct: 5, years: 0 });
    expect(r.projectedValueOmr).toBe(100000);
    expect(r.totalGainOmr).toBe(0);
    expect(r.cagrPct).toBe(0);
  });
});

describe("paymentPlan", () => {
  it("reservation (5%) + down (15%) + all instalments sum EXACTLY to price (uneven split)", () => {
    // 100000: 5% reservation = 5000, 15% down = 15000, balance 80000 over 12
    // quarters => 6666.667, remainder absorbed by the final instalment.
    const p = paymentPlan({ priceOmr: 100000, years: 3, installmentsPerYear: 4 });
    expect(p.reservationOmr).toBe(5000);
    expect(p.downOmr).toBe(15000);
    expect(p.balanceOmr).toBe(80000);
    expect(p.installmentsCount).toBe(12);
    expect(p.installmentOmr).toBe(6666.667);

    const installments = p.schedule.filter((s) => s.label.startsWith("Installment"));
    const installmentSum = installments.reduce((acc, s) => acc + s.amountOmr, 0);
    // reservation + down + all instalments === price (rounded to baisa to clear float noise)
    const total = Math.round((p.reservationOmr + p.downOmr + installmentSum) * 1000) / 1000;
    expect(total).toBe(100000);

    // whole schedule also reconciles to price
    const scheduleTotal =
      Math.round(p.schedule.reduce((acc, s) => acc + s.amountOmr, 0) * 1000) / 1000;
    expect(scheduleTotal).toBe(100000);
  });

  it("applies defaults (15% down, 5y, quarterly => 20 instalments) and reconciles", () => {
    const p = paymentPlan({ priceOmr: 250000 });
    expect(p.reservationOmr).toBe(12500); // standard 5%
    expect(p.downOmr).toBe(37500);
    expect(p.installmentsCount).toBe(20);
    const scheduleTotal =
      Math.round(p.schedule.reduce((acc, s) => acc + s.amountOmr, 0) * 1000) / 1000;
    expect(scheduleTotal).toBe(250000);
  });

  it("folds a reservation deposit into the plan and still reconciles", () => {
    const p = paymentPlan({ priceOmr: 200000, reservationOmr: 500, downPct: 0.2 });
    expect(p.reservationOmr).toBe(500);
    expect(p.downOmr).toBe(40000);
    expect(p.balanceOmr).toBe(159500);
    expect(p.schedule[0]).toEqual({ label: "Reservation", dueMonthsFromNow: 0, amountOmr: 500 });
    const scheduleTotal =
      Math.round(p.schedule.reduce((acc, s) => acc + s.amountOmr, 0) * 1000) / 1000;
    expect(scheduleTotal).toBe(200000);
  });
});

describe("mortgageMonthly", () => {
  it("handles a 0% rate as straight division", () => {
    const r = mortgageMonthly({ principalOmr: 120000, annualRatePct: 0, years: 10 });
    expect(r.monthlyOmr).toBe(1000);
    expect(r.totalPaidOmr).toBe(120000);
    expect(r.totalInterestOmr).toBe(0);
  });

  it("amortises a positive rate (interest > 0, total > principal)", () => {
    const r = mortgageMonthly({ principalOmr: 100000, annualRatePct: 5, years: 20 });
    // annuity payment ~ 660 OMR/month
    expect(r.monthlyOmr).toBeGreaterThan(659);
    expect(r.monthlyOmr).toBeLessThan(661);
    expect(r.totalInterestOmr).toBeGreaterThan(0);
    expect(r.totalPaidOmr).toBeGreaterThan(100000);
    // totals reconcile with the displayed monthly
    expect(r.totalPaidOmr).toBe(Math.round(r.monthlyOmr * 240 * 1000) / 1000);
  });
});

describe("residencyTier", () => {
  it("returns golden_10yr at exactly 200000", () => {
    const r = residencyTier({ priceOmr: 200000 });
    expect(r.tier).toBe("golden_10yr");
    expect(r.minOmr).toBe(200000);
    expect(r.note).toContain("Royal Oman Police");
  });

  it("returns investor_2yr at exactly 50000", () => {
    const r = residencyTier({ priceOmr: 50000 });
    expect(r.tier).toBe("investor_2yr");
    expect(r.minOmr).toBe(50000);
    expect(r.note).toContain("Royal Oman Police");
  });

  it("returns none just below the 50000 threshold", () => {
    expect(residencyTier({ priceOmr: 49999.999 }).tier).toBe("none");
  });

  it("returns investor_2yr just below the 200000 threshold", () => {
    expect(residencyTier({ priceOmr: 199999.999 }).tier).toBe("investor_2yr");
  });
});

describe("commissionBreakdown", () => {
  it("splits gross into agent share and Alwalaa net", () => {
    const r = commissionBreakdown({ propertyValueOmr: 200000, developerRatePct: 3.5, agentSplitPct: 50 });
    expect(r.alwalaaGrossOmr).toBe(7000);
    expect(r.agentShareOmr).toBe(3500);
    expect(r.alwalaaNetOmr).toBe(3500);
  });
});

describe("omrToUsd", () => {
  it("converts at the pegged 2.60 rate", () => {
    expect(omrToUsd(1000)).toBe(2600);
    expect(omrToUsd(2.5)).toBe(6.5);
  });
});
