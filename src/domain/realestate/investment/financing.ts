// Reusable loan amortization engine. Pure and deterministic — no UI, no I/O.
//
// Supports: standard annuity loans, an initial grace period (payments paused,
// interest accrues and capitalizes), an interest-only period, a balloon at
// maturity, and monthly or quarterly payment frequency. Money is OMR (3 dp);
// rates are whole percents (5.5 = 5.5%).
//
// Developer payment plans are NOT loans — they are scheduled price instalments
// with no interest — and are modeled by `paymentPlan` in ../calculators plus
// the projection engine's pre-handover outflows. This module is banks only.
import Decimal from "decimal.js";
import { d, roundOMR } from "../../money";

export interface LoanInput {
  /** Principal drawn in OMR. */
  principalOmr: number;
  /** Annual nominal interest rate as a whole percent (5.5 = 5.5%). */
  annualRatePct: number;
  /** Term in years, counted from first repayment (grace excluded). */
  termYears: number;
  /** 12 = monthly (default), 4 = quarterly. */
  paymentsPerYear?: 12 | 4;
  /** Months at the start where nothing is paid and interest capitalizes monthly. Default 0. */
  graceMonths?: number;
  /** Months (after grace) where only interest is paid. Default 0. Must be < term. */
  interestOnlyMonths?: number;
  /** Balloon due with the final payment, OMR. Default 0. */
  balloonOmr?: number;
  /** One-off lender fees in OMR (arrangement, valuation…) — reported, not capitalized. */
  feesOmr?: number;
}

export interface LoanPeriod {
  /** 1-based payment number (grace months are period 0 entries). */
  period: number;
  /** Months from drawdown when this payment falls due. */
  monthsFromStart: number;
  paymentOmr: number;
  interestOmr: number;
  principalOmr: number;
  /** Balance remaining AFTER this payment. */
  balanceOmr: number;
  phase: "grace" | "interest_only" | "amortizing";
}

export interface LoanSchedule {
  /** The regular amortizing payment per period, OMR. */
  paymentOmr: number;
  /** The interest-only payment per period (0 when no IO phase), OMR. */
  interestOnlyPaymentOmr: number;
  /** Debt service over the first fully-amortizing year — the stabilized figure DSCR uses. */
  stabilizedAnnualDebtServiceOmr: number;
  /** Balance after the grace period capitalization (== principal when no grace). */
  capitalizedPrincipalOmr: number;
  totalPaidOmr: number;
  /**
   * Interest PAID across the schedule. Interest capitalized during a grace
   * period is not paid — it becomes principal (capitalizedPrincipal − original
   * principal) and is repaid, with interest on it, through the payments. The
   * borrower's full financing cost vs the original principal is
   * totalPaidOmr − principalOmr.
   */
  totalInterestOmr: number;
  feesOmr: number;
  periods: LoanPeriod[];
  /** Balance outstanding at the END of each year from drawdown; index 0 = end of year 1. */
  balanceByYearOmr: number[];
  /** Total debt service falling due in each year from drawdown; index 0 = year 1. */
  debtServiceByYearOmr: number[];
  /** Principal repaid in each year from drawdown; index 0 = year 1. */
  principalByYearOmr: number[];
  /** Interest paid in each year from drawdown; index 0 = year 1. */
  interestByYearOmr: number[];
}

/**
 * Builds the full loan schedule.
 *
 * Phases: grace (interest capitalizes monthly, no cash out) → interest-only →
 * amortizing. With a balloon B, the regular payment amortizes only the part of
 * the balance not covered by B's present value:
 *
 *   payment = (P − B·(1+i)^−n) · i / (1 − (1+i)^−n)
 *
 * where i is the periodic rate and n the number of amortizing periods; the
 * balloon is then due with the final payment. A 0% rate divides the balance
 * (minus balloon) straight-line. The schedule reconciles: the last amortizing
 * payment absorbs rounding so the final balance is exactly 0.
 */
export function buildLoanSchedule(input: LoanInput): LoanSchedule {
  const {
    principalOmr,
    annualRatePct,
    termYears,
    paymentsPerYear = 12,
    graceMonths = 0,
    interestOnlyMonths = 0,
    balloonOmr = 0,
    feesOmr = 0,
  } = input;

  const empty: LoanSchedule = {
    paymentOmr: 0,
    interestOnlyPaymentOmr: 0,
    stabilizedAnnualDebtServiceOmr: 0,
    capitalizedPrincipalOmr: roundOMR(principalOmr),
    totalPaidOmr: 0,
    totalInterestOmr: 0,
    feesOmr: roundOMR(feesOmr),
    periods: [],
    balanceByYearOmr: [],
    debtServiceByYearOmr: [],
    principalByYearOmr: [],
    interestByYearOmr: [],
  };
  if (principalOmr <= 0 || termYears <= 0) return empty;

  const monthsPerPeriod = 12 / paymentsPerYear;
  const periodicRate = d(annualRatePct).dividedBy(100).dividedBy(paymentsPerYear);
  const monthlyRate = d(annualRatePct).dividedBy(100).dividedBy(12);

  const periods: LoanPeriod[] = [];

  // --- Grace: interest accrues monthly and capitalizes; no cash movement.
  let balance = d(principalOmr);
  for (let m = 1; m <= graceMonths; m++) {
    balance = balance.plus(balance.times(monthlyRate));
    periods.push({
      period: 0,
      monthsFromStart: m,
      paymentOmr: 0,
      interestOmr: 0, // accrued, not paid — capitalized into the balance
      principalOmr: 0,
      balanceOmr: roundOMR(balance),
      phase: "grace",
    });
  }
  const capitalizedPrincipalOmr = roundOMR(balance);
  balance = d(capitalizedPrincipalOmr);

  // --- Split the term into interest-only and amortizing periods.
  const totalPeriods = Math.round(termYears * paymentsPerYear);
  const ioPeriods = Math.min(totalPeriods, Math.floor(interestOnlyMonths / monthsPerPeriod));
  const amortPeriods = totalPeriods - ioPeriods;

  // A balloon cannot exceed what is owed — clamp so an oversized balloon
  // degrades to interest-only-until-maturity instead of negative payments.
  const balloonClampedOmr = Math.min(Math.max(0, balloonOmr), roundOMR(balance));

  const ioPayment = balance.times(periodicRate);
  const interestOnlyPaymentOmr = ioPeriods > 0 ? roundOMR(ioPayment) : 0;

  // --- Regular amortizing payment (balloon-aware).
  let payment: Decimal;
  if (amortPeriods <= 0) {
    payment = d(0);
  } else if (periodicRate.isZero()) {
    payment = balance.minus(balloonClampedOmr).dividedBy(amortPeriods);
  } else {
    const discount = periodicRate.plus(1).pow(-amortPeriods);
    payment = balance
      .minus(d(balloonClampedOmr).times(discount))
      .times(periodicRate)
      .dividedBy(d(1).minus(discount));
  }
  const paymentOmr = roundOMR(payment);

  let periodNo = 0;
  let totalPaid = d(0);
  let totalInterest = d(0);

  for (let p = 1; p <= ioPeriods; p++) {
    periodNo += 1;
    const interest = roundOMR(balance.times(periodicRate));
    totalPaid = totalPaid.plus(interest);
    totalInterest = totalInterest.plus(interest);
    periods.push({
      period: periodNo,
      monthsFromStart: graceMonths + periodNo * monthsPerPeriod,
      paymentOmr: interest,
      interestOmr: interest,
      principalOmr: 0,
      balanceOmr: roundOMR(balance),
      phase: "interest_only",
    });
  }

  for (let p = 1; p <= amortPeriods; p++) {
    periodNo += 1;
    const isLast = p === amortPeriods;
    const interest = roundOMR(balance.times(periodicRate));
    let principalPart: number;
    let pay: number;
    if (isLast) {
      // Final payment clears the remaining balance exactly (plus the balloon).
      principalPart = roundOMR(balance);
      pay = roundOMR(d(principalPart).plus(interest));
    } else {
      pay = paymentOmr;
      principalPart = roundOMR(d(pay).minus(interest));
    }
    balance = d(roundOMR(balance.minus(principalPart)));
    totalPaid = totalPaid.plus(pay);
    totalInterest = totalInterest.plus(interest);
    periods.push({
      period: periodNo,
      monthsFromStart: graceMonths + (ioPeriods + p) * monthsPerPeriod,
      paymentOmr: pay,
      interestOmr: interest,
      principalOmr: principalPart,
      balanceOmr: roundOMR(balance),
      phase: "amortizing",
    });
  }

  // --- Yearly aggregates (calendar years from drawdown month 0).
  const lastMonth = periods.length > 0 ? periods[periods.length - 1].monthsFromStart : 0;
  const years = Math.max(1, Math.ceil(lastMonth / 12));
  const debtServiceByYearOmr = new Array<number>(years).fill(0);
  const principalByYearOmr = new Array<number>(years).fill(0);
  const interestByYearOmr = new Array<number>(years).fill(0);
  const balanceByYearOmr = new Array<number>(years).fill(0);
  let running = capitalizedPrincipalOmr;
  for (const per of periods) {
    const y = Math.min(years - 1, Math.ceil(per.monthsFromStart / 12) - 1);
    if (per.phase !== "grace") {
      debtServiceByYearOmr[y] = roundOMR(d(debtServiceByYearOmr[y]).plus(per.paymentOmr));
      principalByYearOmr[y] = roundOMR(d(principalByYearOmr[y]).plus(per.principalOmr));
      interestByYearOmr[y] = roundOMR(d(interestByYearOmr[y]).plus(per.interestOmr));
    }
    running = per.balanceOmr;
    balanceByYearOmr[y] = running; // last period in the year wins
  }
  // Years with no scheduled payment (fully inside grace) carry the balance forward.
  for (let y = 1; y < years; y++) {
    if (balanceByYearOmr[y] === 0 && debtServiceByYearOmr[y] === 0 && principalByYearOmr[y] === 0) {
      balanceByYearOmr[y] = balanceByYearOmr[y - 1];
    }
  }

  // Stabilized annual debt service: regular payment × frequency (the figure a
  // bank underwrites DSCR against once IO/grace ends).
  const stabilizedAnnualDebtServiceOmr =
    amortPeriods > 0 ? roundOMR(d(paymentOmr).times(paymentsPerYear)) : roundOMR(ioPayment.times(paymentsPerYear));

  return {
    paymentOmr,
    interestOnlyPaymentOmr,
    stabilizedAnnualDebtServiceOmr,
    capitalizedPrincipalOmr,
    totalPaidOmr: roundOMR(totalPaid),
    totalInterestOmr: roundOMR(totalInterest),
    feesOmr: roundOMR(feesOmr),
    periods,
    balanceByYearOmr,
    debtServiceByYearOmr,
    principalByYearOmr,
    interestByYearOmr,
  };
}

/** Loan-to-value as a whole percent; null when value is 0. */
export function loanToValuePct(loanOmr: number, valueOmr: number): number | null {
  if (valueOmr <= 0) return null;
  return d(loanOmr).dividedBy(valueOmr).times(100).toDecimalPlaces(2).toNumber();
}
