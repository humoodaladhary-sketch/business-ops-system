import { describe, it, expect } from "vitest";
import { buildLoanSchedule, loanToValuePct } from "./financing";
import { mortgageMonthly } from "../calculators";

describe("buildLoanSchedule", () => {
  it("matches the existing mortgage calculator for a plain annuity loan", () => {
    const s = buildLoanSchedule({ principalOmr: 100000, annualRatePct: 5, termYears: 20 });
    const legacy = mortgageMonthly({ principalOmr: 100000, annualRatePct: 5, years: 20 });
    expect(s.paymentOmr).toBe(legacy.monthlyOmr); // 659.956
    expect(s.periods).toHaveLength(240);
    expect(s.stabilizedAnnualDebtServiceOmr).toBe(legacy.monthlyOmr * 12);
    // Final payment clears the balance exactly
    expect(s.periods[239].balanceOmr).toBe(0);
    // Principal repaid across the schedule reconciles to the principal
    const principalSum = s.periods.reduce((acc, p) => acc + p.principalOmr, 0);
    expect(Math.round(principalSum * 1000) / 1000).toBe(100000);
  });

  it("0% rate divides straight-line with zero interest", () => {
    const s = buildLoanSchedule({ principalOmr: 12000, annualRatePct: 0, termYears: 1 });
    expect(s.paymentOmr).toBe(1000);
    expect(s.totalInterestOmr).toBe(0);
    expect(s.totalPaidOmr).toBe(12000);
    expect(s.periods[11].balanceOmr).toBe(0);
  });

  it("interest-only phase pays interest, holds the balance, then amortizes", () => {
    const s = buildLoanSchedule({
      principalOmr: 100000,
      annualRatePct: 6,
      termYears: 10,
      interestOnlyMonths: 24,
    });
    // IO payment = 100000 × 6%/12 = 500/month
    expect(s.interestOnlyPaymentOmr).toBe(500);
    const io = s.periods.filter((p) => p.phase === "interest_only");
    expect(io).toHaveLength(24);
    expect(io[0].paymentOmr).toBe(500);
    expect(io[0].principalOmr).toBe(0);
    expect(io[23].balanceOmr).toBe(100000); // untouched through IO
    // Then 96 amortizing periods clear it
    const amort = s.periods.filter((p) => p.phase === "amortizing");
    expect(amort).toHaveLength(96);
    expect(amort[95].balanceOmr).toBe(0);
    // Amortizing payment beats the IO payment (it now carries principal)
    expect(s.paymentOmr).toBeGreaterThan(500);
  });

  it("grace period capitalizes interest monthly into the principal", () => {
    const s = buildLoanSchedule({
      principalOmr: 100000,
      annualRatePct: 12,
      termYears: 5,
      graceMonths: 12,
    });
    // 100000 × 1.01^12 = 112682.503
    expect(s.capitalizedPrincipalOmr).toBe(112682.503);
    const grace = s.periods.filter((p) => p.phase === "grace");
    expect(grace).toHaveLength(12);
    expect(grace.every((p) => p.paymentOmr === 0)).toBe(true);
    // Amortization then runs on the capitalized balance and clears it
    expect(s.periods[s.periods.length - 1].balanceOmr).toBe(0);
    const principalSum = s.periods.reduce((acc, p) => acc + p.principalOmr, 0);
    expect(Math.round(principalSum * 1000) / 1000).toBe(112682.503);
  });

  it("balloon reduces the regular payment and lands in the final payment", () => {
    const plain = buildLoanSchedule({ principalOmr: 100000, annualRatePct: 5, termYears: 10 });
    const balloon = buildLoanSchedule({
      principalOmr: 100000,
      annualRatePct: 5,
      termYears: 10,
      balloonOmr: 40000,
    });
    expect(balloon.paymentOmr).toBeLessThan(plain.paymentOmr);
    const last = balloon.periods[balloon.periods.length - 1];
    // Final payment carries the balloon (≈ 40000 + interest) and clears the loan
    expect(last.paymentOmr).toBeGreaterThan(40000);
    expect(last.balanceOmr).toBe(0);
    // Second-to-last balance is the balloon plus the final payment's principal
    // component — within one regular payment of the balloon amount.
    const penultimate = balloon.periods[balloon.periods.length - 2];
    expect(Math.abs(penultimate.balanceOmr - 40000)).toBeLessThan(balloon.paymentOmr + 1);
  });

  it("quarterly frequency produces 4 payments/year with matching aggregates", () => {
    const s = buildLoanSchedule({
      principalOmr: 60000,
      annualRatePct: 4,
      termYears: 5,
      paymentsPerYear: 4,
    });
    expect(s.periods).toHaveLength(20);
    expect(s.stabilizedAnnualDebtServiceOmr).toBe(s.paymentOmr * 4);
    expect(s.debtServiceByYearOmr).toHaveLength(5);
    // Every year carries 4 payments
    const yearOne = s.periods.filter((p) => p.monthsFromStart <= 12);
    expect(yearOne).toHaveLength(4);
  });

  it("yearly aggregates reconcile: debt service = principal + interest", () => {
    const s = buildLoanSchedule({ principalOmr: 50000, annualRatePct: 5.5, termYears: 3 });
    for (let y = 0; y < 3; y++) {
      const sum = Math.round((s.principalByYearOmr[y] + s.interestByYearOmr[y]) * 1000) / 1000;
      expect(sum).toBe(s.debtServiceByYearOmr[y]);
    }
    expect(s.balanceByYearOmr[2]).toBe(0);
  });

  it("guards zero principal and zero term with an empty schedule", () => {
    expect(buildLoanSchedule({ principalOmr: 0, annualRatePct: 5, termYears: 10 }).periods).toHaveLength(0);
    expect(buildLoanSchedule({ principalOmr: 100, annualRatePct: 5, termYears: 0 }).periods).toHaveLength(0);
  });
});

describe("loanToValuePct", () => {
  it("computes LTV and guards zero value with null", () => {
    expect(loanToValuePct(100000, 145000)).toBe(68.97);
    expect(loanToValuePct(100000, 0)).toBeNull();
  });
});
