// Pure real-estate investment calculators for Alwalaa (Muscat brokerage selling
// Oman ITC freehold to foreign investors). Every function is pure and typed.
//
// Money is Omani Rial (OMR). The Rial has 3 decimal places (1 OMR = 1000
// baisa), so all monetary results are rounded to 3 dp (half-up) via the shared
// money helpers. Percentages are rounded to 2 dp. All "...Pct" INPUTS on this
// module are whole percents (e.g. 3.5 = 3.5%, 7 = 7%) EXCEPT paymentPlan.downPct,
// which is a fraction (0.15 = 15%) — see its JSDoc.
//
// IMPORTANT: yield and capital-appreciation outputs are ASSUMPTIONS driven by
// caller-supplied rent/cost/growth inputs. They are illustrative, not a
// guaranteed or forecast return. This is stated on each such function.
import Decimal from "decimal.js";
import { d, roundOMR } from "../money";

/** Round a percentage value to 2 dp, half-up. */
function roundPct(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Round a USD value to cents (2 dp), half-up. */
function roundUsd(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

// ---------------------------------------------------------------------------
// Yield
// ---------------------------------------------------------------------------

export interface GrossAndNetYieldInput {
  /** Purchase price in OMR. */
  priceOmr: number;
  /** Expected gross annual rent in OMR (an assumption). */
  annualRentOmr: number;
  /** Expected annual holding costs in OMR — service charge, management, etc. (an assumption). */
  annualCostsOmr: number;
}

export interface GrossAndNetYieldResult {
  /** Gross rental yield: annualRent / price, as a percent (2 dp). */
  grossYieldPct: number;
  /** Net rental yield: (annualRent − annualCosts) / price, as a percent (2 dp). */
  netYieldPct: number;
  /** Net annual income in OMR (3 dp). May be negative if costs exceed rent. */
  annualNetOmr: number;
}

/**
 * Gross and net rental yield for a unit.
 *
 * @remarks ASSUMPTION: rent and costs are estimates supplied by the caller.
 * The resulting yields are illustrative, not a guaranteed return. A zero or
 * negative price yields 0% (guarded).
 */
export function grossAndNetYield(input: GrossAndNetYieldInput): GrossAndNetYieldResult {
  const { priceOmr, annualRentOmr, annualCostsOmr } = input;
  const annualNet = d(annualRentOmr).minus(annualCostsOmr);
  if (priceOmr <= 0) {
    return { grossYieldPct: 0, netYieldPct: 0, annualNetOmr: roundOMR(annualNet) };
  }
  return {
    grossYieldPct: roundPct(d(annualRentOmr).dividedBy(priceOmr).times(100)),
    netYieldPct: roundPct(annualNet.dividedBy(priceOmr).times(100)),
    annualNetOmr: roundOMR(annualNet),
  };
}

// ---------------------------------------------------------------------------
// Capital appreciation
// ---------------------------------------------------------------------------

export interface CapitalAppreciationInput {
  /** Purchase price in OMR. */
  priceOmr: number;
  /** Assumed annual capital growth as a whole percent (e.g. 7 = 7%). */
  annualGrowthPct: number;
  /** Holding period in years. */
  years: number;
}

export interface CapitalAppreciationResult {
  /** Projected value after `years` at the assumed growth, in OMR (3 dp). */
  projectedValueOmr: number;
  /** Total capital gain over the period in OMR (3 dp). */
  totalGainOmr: number;
  /** Compound annual growth rate implied by the projection, as a percent (2 dp). */
  cagrPct: number;
}

/**
 * Projected value and gain from compounding an assumed annual growth rate.
 *
 * @remarks ASSUMPTION: `annualGrowthPct` is a caller-supplied illustration, not
 * a forecast. Under constant growth the CAGR equals the input growth rate; it
 * is recomputed from the projection so the figure stays honest if inputs change.
 * Zero price or zero years yields a 0% CAGR (guarded).
 */
export function capitalAppreciation(input: CapitalAppreciationInput): CapitalAppreciationResult {
  const { priceOmr, annualGrowthPct, years } = input;
  const factor = d(1).plus(d(annualGrowthPct).dividedBy(100));
  const projected = d(priceOmr).times(factor.pow(years));

  const projectedValueOmr = roundOMR(projected);
  const totalGainOmr = roundOMR(d(projectedValueOmr).minus(priceOmr));

  let cagrPct = 0;
  if (priceOmr > 0 && years > 0) {
    const ratio = projected.dividedBy(priceOmr); // = factor^years
    cagrPct = roundPct(ratio.pow(d(1).dividedBy(years)).minus(1).times(100));
  }

  return { projectedValueOmr, totalGainOmr, cagrPct };
}

// ---------------------------------------------------------------------------
// Payment plan
// ---------------------------------------------------------------------------

export interface PaymentPlanInput {
  /** Purchase price in OMR. */
  priceOmr: number;
  /** Reservation deposit in OMR paid up front. Default 0. */
  reservationOmr?: number;
  /** Down payment as a FRACTION of price (0.15 = 15%). Default 0.15. */
  downPct?: number;
  /** Number of years the balance is spread over. Default 5. */
  years?: number;
  /** Instalments per year (4 = quarterly). Default 4. */
  installmentsPerYear?: number;
}

export interface PaymentScheduleEntry {
  /** Human label, e.g. "Reservation", "Down payment", "Installment 3 of 20". */
  label: string;
  /** Months from now the payment is due (0 = on signing). */
  dueMonthsFromNow: number;
  /** Amount due in OMR (3 dp). */
  amountOmr: number;
}

export interface PaymentPlanResult {
  reservationOmr: number;
  downOmr: number;
  /** Balance financed over the instalment period (price − reservation − down), OMR. */
  balanceOmr: number;
  /** The regular per-instalment amount in OMR (the final one may differ by a few baisa). */
  installmentOmr: number;
  /** Number of periodic instalments (years × installmentsPerYear). */
  installmentsCount: number;
  /**
   * Full dated payment timeline: reservation (if any) + down (if any) + every
   * instalment. The amounts across the whole schedule sum EXACTLY to priceOmr.
   */
  schedule: PaymentScheduleEntry[];
}

/**
 * Builds a reservation + down-payment + equal-instalment plan.
 *
 * Reconciliation guarantee: `reservationOmr + downOmr + (sum of all
 * instalments) === priceOmr` exactly. The final instalment absorbs any
 * rounding remainder, so it can differ from `installmentOmr` by a few baisa.
 *
 * Assumes `years >= 1` and `installmentsPerYear >= 1`.
 */
export function paymentPlan(input: PaymentPlanInput): PaymentPlanResult {
  const {
    priceOmr,
    reservationOmr: reservationInput = 0,
    downPct = 0.15,
    years = 5,
    installmentsPerYear = 4,
  } = input;

  const reservationOmr = roundOMR(reservationInput);
  const downOmr = roundOMR(d(priceOmr).times(downPct));
  const balanceOmr = roundOMR(d(priceOmr).minus(reservationOmr).minus(downOmr));

  const count = Math.max(0, Math.round(years * installmentsPerYear));
  const installmentOmr = count > 0 ? roundOMR(d(balanceOmr).dividedBy(count)) : 0;
  const monthsPer = installmentsPerYear > 0 ? 12 / installmentsPerYear : 0;

  const schedule: PaymentScheduleEntry[] = [];
  if (reservationOmr > 0) {
    schedule.push({ label: "Reservation", dueMonthsFromNow: 0, amountOmr: reservationOmr });
  }
  if (downOmr > 0) {
    schedule.push({ label: "Down payment", dueMonthsFromNow: 0, amountOmr: downOmr });
  }

  let allocated = 0;
  for (let i = 1; i <= count; i++) {
    const isLast = i === count;
    // The last instalment takes the exact remaining balance so the plan reconciles.
    const amountOmr = isLast ? roundOMR(d(balanceOmr).minus(allocated)) : installmentOmr;
    allocated = roundOMR(d(allocated).plus(amountOmr));
    schedule.push({
      label: `Installment ${i} of ${count}`,
      dueMonthsFromNow: Math.round(monthsPer * i),
      amountOmr,
    });
  }

  return { reservationOmr, downOmr, balanceOmr, installmentOmr, installmentsCount: count, schedule };
}

// ---------------------------------------------------------------------------
// Mortgage
// ---------------------------------------------------------------------------

export interface MortgageMonthlyInput {
  /** Loan principal in OMR. */
  principalOmr: number;
  /** Annual interest rate as a whole percent (e.g. 5 = 5%). */
  annualRatePct: number;
  /** Loan term in years. */
  years: number;
}

export interface MortgageMonthlyResult {
  /** Level monthly repayment in OMR (3 dp). */
  monthlyOmr: number;
  /** Total repaid over the term in OMR (3 dp). */
  totalPaidOmr: number;
  /** Total interest over the term in OMR (3 dp). */
  totalInterestOmr: number;
}

/**
 * Standard amortising (annuity) mortgage repayment.
 *
 * Handles a 0% rate as straight-line division (principal / months). Totals are
 * derived from the rounded monthly payment so they reconcile with what a
 * borrower actually pays. Assumes `years >= 1`.
 */
export function mortgageMonthly(input: MortgageMonthlyInput): MortgageMonthlyResult {
  const { principalOmr, annualRatePct, years } = input;
  const n = Math.max(0, Math.round(years * 12));
  if (n <= 0) {
    return { monthlyOmr: 0, totalPaidOmr: 0, totalInterestOmr: 0 };
  }

  const principal = d(principalOmr);
  const monthlyRate = d(annualRatePct).dividedBy(100).dividedBy(12);

  let monthly: Decimal;
  if (monthlyRate.isZero()) {
    monthly = principal.dividedBy(n); // 0% → straight division
  } else {
    const growth = monthlyRate.plus(1).pow(n);
    monthly = principal.times(monthlyRate).times(growth).dividedBy(growth.minus(1));
  }

  const monthlyOmr = roundOMR(monthly);
  const totalPaidOmr = roundOMR(d(monthlyOmr).times(n));
  const totalInterestOmr = roundOMR(d(totalPaidOmr).minus(principalOmr));

  return { monthlyOmr, totalPaidOmr, totalInterestOmr };
}

// ---------------------------------------------------------------------------
// Residency
// ---------------------------------------------------------------------------

export type ResidencyTierName = "none" | "investor_2yr" | "golden_10yr";

export interface ResidencyTierInput {
  /** Purchase / investment amount in OMR. */
  priceOmr: number;
}

export interface ResidencyTierResult {
  tier: ResidencyTierName;
  /** Minimum OMR investment for this tier. */
  minOmr: number;
  note: string;
}

const RESIDENCY_DISCLAIMER =
  "Final eligibility is decided by the Royal Oman Police — this is guidance, not a guarantee.";

/**
 * Maps an investment amount to an Oman residency tier by threshold.
 *
 * - ≥ 200,000 OMR → golden_10yr (10-year Investor/Golden Residency)
 * - ≥  50,000 OMR → investor_2yr (2-year Investor Residency)
 * - otherwise     → none
 *
 * Thresholds are inclusive at exactly 50,000 and 200,000. The note always
 * states that the Royal Oman Police make the final call.
 */
export function residencyTier(input: ResidencyTierInput): ResidencyTierResult {
  const { priceOmr } = input;
  if (priceOmr >= 200000) {
    return {
      tier: "golden_10yr",
      minOmr: 200000,
      note: `Qualifies toward the 10-year Golden/Investor Residency. ${RESIDENCY_DISCLAIMER}`,
    };
  }
  if (priceOmr >= 50000) {
    return {
      tier: "investor_2yr",
      minOmr: 50000,
      note: `Qualifies toward the 2-year Investor Residency. ${RESIDENCY_DISCLAIMER}`,
    };
  }
  return {
    tier: "none",
    minOmr: 0,
    note: `Below the 50,000 OMR Investor Residency threshold. ${RESIDENCY_DISCLAIMER}`,
  };
}

// ---------------------------------------------------------------------------
// Commission (INTERNAL — never surface to clients)
// ---------------------------------------------------------------------------

export interface CommissionBreakdownInput {
  /** Sale value of the property in OMR. */
  propertyValueOmr: number;
  /** Developer → Alwalaa commission rate as a whole percent (e.g. 3.5 = 3.5%). */
  developerRatePct: number;
  /** Agent's share of the gross as a whole percent (e.g. 50 = 50%). */
  agentSplitPct: number;
}

export interface CommissionBreakdownResult {
  /** Gross commission Alwalaa earns from the developer, OMR (3 dp). */
  alwalaaGrossOmr: number;
  /** Portion paid to the agent, OMR (3 dp). */
  agentShareOmr: number;
  /** Alwalaa's net after the agent share, OMR (3 dp). */
  alwalaaNetOmr: number;
}

/**
 * Internal commission split. Do NOT expose in any client-facing document.
 *   gross      = value × developerRatePct / 100
 *   agentShare = gross × agentSplitPct / 100
 *   net        = gross − agentShare
 */
export function commissionBreakdown(input: CommissionBreakdownInput): CommissionBreakdownResult {
  const { propertyValueOmr, developerRatePct, agentSplitPct } = input;
  const alwalaaGrossOmr = roundOMR(d(propertyValueOmr).times(developerRatePct).dividedBy(100));
  const agentShareOmr = roundOMR(d(alwalaaGrossOmr).times(agentSplitPct).dividedBy(100));
  const alwalaaNetOmr = roundOMR(d(alwalaaGrossOmr).minus(agentShareOmr));
  return { alwalaaGrossOmr, agentShareOmr, alwalaaNetOmr };
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/** Indicative OMR→USD rate. OMR is pegged; use a flat 2.60 for quotes. */
export const OMR_TO_USD_RATE = 2.6;

/**
 * Converts OMR to USD at the indicative pegged rate (1 OMR = 2.60 USD).
 * USD is returned rounded to cents (2 dp). Indicative only.
 */
export function omrToUsd(omr: number): number {
  return roundUsd(d(omr).times(OMR_TO_USD_RATE));
}
