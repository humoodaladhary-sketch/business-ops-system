// Core investment metrics. Pure, deterministic, and honest about undefined
// values: where a ratio has no meaning (zero denominator, no sign change for
// IRR) the result is null — never a fabricated 0. Percents are whole percents
// (7.5 = 7.5%); money is OMR (3 dp).
import { d, roundOMR } from "../../money";
import { roundPct } from "./acquisition";

// ---------------------------------------------------------------------------
// Simple ratios
// ---------------------------------------------------------------------------

/** Gross rental yield: annual gross income / price, whole percent. Null when price ≤ 0. */
export function grossYieldPct(annualGrossIncomeOmr: number, priceOmr: number): number | null {
  if (priceOmr <= 0) return null;
  return roundPct(d(annualGrossIncomeOmr).dividedBy(priceOmr).times(100).toNumber());
}

/** Net rental yield: NOI / price, whole percent. Null when price ≤ 0. */
export function netYieldPct(noiOmr: number, priceOmr: number): number | null {
  if (priceOmr <= 0) return null;
  return roundPct(d(noiOmr).dividedBy(priceOmr).times(100).toNumber());
}

/** Capitalization rate: NOI / value, whole percent. Null when value ≤ 0. */
export function capRatePct(noiOmr: number, valueOmr: number): number | null {
  if (valueOmr <= 0) return null;
  return roundPct(d(noiOmr).dividedBy(valueOmr).times(100).toNumber());
}

/** Cash-on-cash: annual pre-tax cash flow / total cash invested, whole percent. Null when cash ≤ 0. */
export function cashOnCashPct(annualCashFlowOmr: number, totalCashInvestedOmr: number): number | null {
  if (totalCashInvestedOmr <= 0) return null;
  return roundPct(d(annualCashFlowOmr).dividedBy(totalCashInvestedOmr).times(100).toNumber());
}

/** Debt-service coverage ratio: NOI / annual debt service (2 dp). Null when debt service ≤ 0 (unlevered). */
export function dscr(noiOmr: number, annualDebtServiceOmr: number): number | null {
  if (annualDebtServiceOmr <= 0) return null;
  return d(noiOmr).dividedBy(annualDebtServiceOmr).toDecimalPlaces(2).toNumber();
}

/** Debt yield: NOI / outstanding loan, whole percent. Null when loan ≤ 0. */
export function debtYieldPct(noiOmr: number, loanOmr: number): number | null {
  if (loanOmr <= 0) return null;
  return roundPct(d(noiOmr).dividedBy(loanOmr).times(100).toNumber());
}

/** Operating-expense ratio: opex / EGI, whole percent. Null when EGI ≤ 0. */
export function operatingExpenseRatioPct(opexOmr: number, egiOmr: number): number | null {
  if (egiOmr <= 0) return null;
  return roundPct(d(opexOmr).dividedBy(egiOmr).times(100).toNumber());
}

/**
 * Break-even occupancy: (operating expenses + debt service − other income) /
 * gross potential rental income, whole percent. Null when gross potential ≤ 0.
 * Can exceed 100% — that is a real finding (the deal cannot break even), not
 * an error, and is reported as calculated.
 */
export function breakEvenOccupancyPct(
  operatingExpensesOmr: number,
  annualDebtServiceOmr: number,
  otherIncomeOmr: number,
  grossPotentialIncomeOmr: number,
): number | null {
  if (grossPotentialIncomeOmr <= 0) return null;
  return roundPct(
    d(operatingExpensesOmr)
      .plus(annualDebtServiceOmr)
      .minus(otherIncomeOmr)
      .dividedBy(grossPotentialIncomeOmr)
      .times(100)
      .toNumber(),
  );
}

/**
 * Break-even gross rent per year: the gross income at which cash flow is zero,
 * given expenses that scale with income (as a fraction) and fixed outgoings.
 *
 *   breakEven = (fixed expenses + debt service) / (1 − variableSharePct/100)
 *
 * Null when the variable share is ≥ 100% (income can never cover costs).
 */
export function breakEvenAnnualRentOmr(
  fixedExpensesOmr: number,
  annualDebtServiceOmr: number,
  variableSharePct: number,
): number | null {
  const variable = d(variableSharePct).dividedBy(100);
  if (variable.greaterThanOrEqualTo(1)) return null;
  return roundOMR(d(fixedExpensesOmr).plus(annualDebtServiceOmr).dividedBy(d(1).minus(variable)));
}

/** Equity multiple: total distributions / total equity invested (2 dp). Null when invested ≤ 0. */
export function equityMultiple(totalDistributionsOmr: number, totalInvestedOmr: number): number | null {
  if (totalInvestedOmr <= 0) return null;
  return d(totalDistributionsOmr).dividedBy(totalInvestedOmr).toDecimalPlaces(2).toNumber();
}

// ---------------------------------------------------------------------------
// Time-value metrics
// ---------------------------------------------------------------------------

/**
 * Net present value of periodic cash flows at a periodic discount rate (whole
 * percent). cashflows[0] is at t=0 (undiscounted). Returns OMR (3 dp). Rates
 * at or below −100% are clamped to −99.99% (a −100% rate has no defined NPV).
 */
export function npvOmr(discountRatePct: number, cashflowsOmr: number[]): number {
  const rate = d(Math.max(discountRatePct, -99.99)).dividedBy(100);
  let acc = d(0);
  for (let t = 0; t < cashflowsOmr.length; t++) {
    acc = acc.plus(d(cashflowsOmr[t]).dividedBy(rate.plus(1).pow(t)));
  }
  return roundOMR(acc);
}

/**
 * Internal rate of return of periodic cash flows, as a whole percent per
 * period (annual flows → annual IRR). Deterministic bisection on the NPV sign
 * change over [−99.9%, 1000%]; null when the flows never change sign (no IRR
 * exists) or no root is bracketed. 2 dp.
 */
export function irrPct(cashflowsOmr: number[]): number | null {
  const hasNegative = cashflowsOmr.some((c) => c < 0);
  const hasPositive = cashflowsOmr.some((c) => c > 0);
  if (!hasNegative || !hasPositive) return null;

  const npvAt = (ratePct: number): number => {
    const rate = 1 + ratePct / 100;
    let acc = 0;
    for (let t = 0; t < cashflowsOmr.length; t++) {
      acc += cashflowsOmr[t] / Math.pow(rate, t);
    }
    return acc;
  };

  let lo = -99.9;
  let hi = 1000;
  let npvLo = npvAt(lo);
  const npvHi = npvAt(hi);
  if (npvLo * npvHi > 0) return null; // no root bracketed in a sane range

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npvAt(mid);
    if (Math.abs(npvMid) < 1e-9 || hi - lo < 1e-9) {
      return roundPct(mid);
    }
    if (npvLo * npvMid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      npvLo = npvMid;
    }
  }
  return roundPct((lo + hi) / 2);
}

/**
 * Modified IRR: negative flows discounted to t0 at the finance rate, positive
 * flows compounded to the horizon at the reinvestment rate.
 *
 *   MIRR = (FV(positives) / −PV(negatives))^(1/n) − 1
 *
 * Null when there is no negative or no positive flow, or n = 0. Whole percent, 2 dp.
 */
export function mirrPct(
  cashflowsOmr: number[],
  financeRatePct: number,
  reinvestRatePct: number,
): number | null {
  const n = cashflowsOmr.length - 1;
  if (n <= 0) return null;
  const fin = d(financeRatePct).dividedBy(100).plus(1);
  const re = d(reinvestRatePct).dividedBy(100).plus(1);

  let pvNeg = d(0);
  let fvPos = d(0);
  for (let t = 0; t < cashflowsOmr.length; t++) {
    const c = d(cashflowsOmr[t]);
    if (c.isNegative()) pvNeg = pvNeg.plus(c.dividedBy(fin.pow(t)));
    if (c.isPositive()) fvPos = fvPos.plus(c.times(re.pow(n - t)));
  }
  if (pvNeg.isZero() || fvPos.isZero()) return null;

  const ratio = fvPos.dividedBy(pvNeg.negated());
  return roundPct(ratio.pow(d(1).dividedBy(n)).minus(1).times(100).toNumber());
}

/**
 * Payback period in years: when the cumulative cash flow first recovers to 0
 * AFTER having been negative, with linear interpolation inside the crossing
 * year. Flows that never go negative have no capital at risk → 0. Null when
 * invested capital is never recovered within the given flows.
 */
export function paybackYears(cashflowsOmr: number[]): number | null {
  let cumulative = 0;
  let wasNegative = false;
  for (let t = 0; t < cashflowsOmr.length; t++) {
    const prev = cumulative;
    cumulative += cashflowsOmr[t];
    if (wasNegative && cumulative >= 0) {
      const within = cashflowsOmr[t] !== 0 ? -prev / cashflowsOmr[t] : 0;
      return Math.round((t - 1 + within) * 100) / 100;
    }
    if (cumulative < 0) wasNegative = true;
  }
  return wasNegative ? null : 0;
}

/** Compound annual growth rate from start to end value over years, whole percent. Null when inputs are non-positive. */
export function cagrPct(startOmr: number, endOmr: number, years: number): number | null {
  if (startOmr <= 0 || endOmr <= 0 || years <= 0) return null;
  return roundPct(
    d(endOmr).dividedBy(startOmr).pow(d(1).dividedBy(years)).minus(1).times(100).toNumber(),
  );
}
