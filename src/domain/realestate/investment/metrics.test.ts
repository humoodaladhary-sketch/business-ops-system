import { describe, it, expect } from "vitest";
import {
  breakEvenAnnualRentOmr,
  breakEvenOccupancyPct,
  cagrPct,
  capRatePct,
  cashOnCashPct,
  debtYieldPct,
  dscr,
  equityMultiple,
  grossYieldPct,
  irrPct,
  mirrPct,
  netYieldPct,
  npvOmr,
  operatingExpenseRatioPct,
  paybackYears,
} from "./metrics";

describe("simple ratios", () => {
  it("yields, cap rate, CoC, DSCR, debt yield, OER", () => {
    expect(grossYieldPct(12000, 145000)).toBe(8.28);
    expect(netYieldPct(9000, 145000)).toBe(6.21);
    expect(capRatePct(9000, 150000)).toBe(6);
    expect(cashOnCashPct(750, 10000)).toBe(7.5);
    expect(dscr(9000, 8250)).toBe(1.09);
    expect(debtYieldPct(9000, 100000)).toBe(9);
    expect(operatingExpenseRatioPct(2400, 11400)).toBe(21.05);
  });

  it("returns null (never a fake 0) for undefined ratios", () => {
    expect(grossYieldPct(12000, 0)).toBeNull();
    expect(netYieldPct(9000, 0)).toBeNull();
    expect(capRatePct(9000, 0)).toBeNull();
    expect(cashOnCashPct(750, 0)).toBeNull();
    expect(dscr(9000, 0)).toBeNull(); // unlevered — DSCR meaningless
    expect(debtYieldPct(9000, 0)).toBeNull();
    expect(operatingExpenseRatioPct(2400, 0)).toBeNull();
  });

  it("handles negative cash flow honestly", () => {
    expect(cashOnCashPct(-1200, 30000)).toBe(-4);
    expect(netYieldPct(-500, 100000)).toBe(-0.5);
  });
});

describe("breakEvenOccupancyPct", () => {
  it("computes (opex + debt − other income) / gross potential", () => {
    // (4200 + 8250 − 450) / 18000 = 66.67%
    expect(breakEvenOccupancyPct(4200, 8250, 450, 18000)).toBe(66.67);
  });

  it("can exceed 100% — a real finding, not an error", () => {
    expect(breakEvenOccupancyPct(9000, 6000, 0, 12000)).toBe(125);
  });

  it("null when gross potential is 0", () => {
    expect(breakEvenOccupancyPct(4200, 8250, 0, 0)).toBeNull();
  });
});

describe("breakEvenAnnualRentOmr", () => {
  it("solves fixed costs against the variable margin", () => {
    // (3000 + 6000) / (1 − 0.10) = 10000
    expect(breakEvenAnnualRentOmr(3000, 6000, 10)).toBe(10000);
  });
  it("null when variable share consumes all income", () => {
    expect(breakEvenAnnualRentOmr(3000, 6000, 100)).toBeNull();
  });
});

describe("npvOmr", () => {
  it("discounts periodic flows with t0 undiscounted", () => {
    // −1000 + 600/1.1 + 600/1.21 = 41.322
    expect(npvOmr(10, [-1000, 600, 600])).toBe(41.322);
  });
  it("zero rate is a plain sum", () => {
    expect(npvOmr(0, [-1000, 400, 700])).toBe(100);
  });
});

describe("irrPct", () => {
  it("solves the classic single-period case exactly", () => {
    expect(irrPct([-100, 110])).toBe(10);
  });

  it("solves a level annuity (3 × 500 on 1000 → 23.38%)", () => {
    expect(irrPct([-1000, 500, 500, 500])).toBe(23.38);
  });

  it("finds negative IRRs (losing deals)", () => {
    // −1000 recovered as 900 in one year = −10%
    expect(irrPct([-1000, 900])).toBe(-10);
  });

  it("null when flows never change sign (no IRR exists)", () => {
    expect(irrPct([100, 200])).toBeNull();
    expect(irrPct([-100, -200])).toBeNull();
    expect(irrPct([0, 0])).toBeNull();
  });
});

describe("mirrPct", () => {
  it("compounds positives at reinvest rate, discounts negatives at finance rate", () => {
    // FV = 300×1.06² + 400×1.06 + 500 = 1261.08; (1261.08/1000)^(1/3) − 1 = 8.04%
    expect(mirrPct([-1000, 300, 400, 500], 8, 6)).toBe(8.04);
  });
  it("null without both signs or with no periods", () => {
    expect(mirrPct([-1000], 8, 6)).toBeNull();
    expect(mirrPct([100, 200], 8, 6)).toBeNull();
  });
});

describe("paybackYears", () => {
  it("interpolates within the crossing year", () => {
    expect(paybackYears([-1000, 400, 400, 400])).toBe(2.5);
  });
  it("exact-year crossing has no fraction", () => {
    expect(paybackYears([-1000, 500, 500])).toBe(2);
  });
  it("null when the investment never pays back", () => {
    expect(paybackYears([-1000, 100, 100])).toBeNull();
  });
  it("negative interim flows are absorbed into the cumulative track", () => {
    // −1000, +800, −300 (cum −500), +1000 → crosses in year 3 at 500/1000
    expect(paybackYears([-1000, 800, -300, 1000])).toBe(2.5);
  });
});

describe("equityMultiple / cagrPct", () => {
  it("computes the multiple and CAGR", () => {
    expect(equityMultiple(158000, 100000)).toBe(1.58);
    expect(cagrPct(100000, 150000, 5)).toBe(8.45);
  });
  it("nulls on non-positive inputs", () => {
    expect(equityMultiple(100, 0)).toBeNull();
    expect(cagrPct(0, 150000, 5)).toBeNull();
    expect(cagrPct(100000, 150000, 0)).toBeNull();
  });
});
