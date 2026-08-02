// Multi-period cash-flow projection (1–30 years, annual or monthly rows).
// Pure and deterministic: escalations, expense inflation, appreciation,
// off-plan handover with delayed rental start, developer payment-plan
// outflows, renovation-year vacancy, capex, exit via appreciated value or
// exit cap rate, and the equity cash-flow vector that IRR/NPV/payback and the
// equity multiple are computed from. Money OMR (3 dp), percents whole.
import { d, roundOMR } from "../../money";
import type { LoanSchedule } from "./financing";
import {
  cagrPct,
  equityMultiple,
  irrPct,
  npvOmr,
  paybackYears,
} from "./metrics";

export interface ScheduledOutflow {
  /** Months from analysis start the payment falls due (0 = signing). */
  monthsFromStart: number;
  amountOmr: number;
  label: string;
}

export interface ProjectionInput {
  /** Analysis price (the capital base appreciation grows from). */
  priceOmr: number;
  /**
   * Cash out at t0: down payment + acquisition costs for a standard purchase.
   * For off-plan payment plans, pass the acquisition costs only and put the
   * price instalments in `scheduledOutflows` — never both.
   */
  initialOutflowOmr: number;
  /** Developer payment-plan instalments (off-plan). Empty for completed purchases. */
  scheduledOutflows?: ScheduledOutflow[];
  /** Pre-built bank-loan schedule; null/absent for unleveraged deals. */
  loan?: LoanSchedule | null;
  /** Stabilized year-1 effective gross income (annualized), OMR. */
  egiOmr: number;
  /** Stabilized year-1 operating expenses (annualized), OMR. */
  opexOmr: number;
  /** Months until handover; 0 for completed property. Income and opex start after it. */
  handoverMonths?: number;
  /** Additional months after handover before rent starts (fit-out, marketing). */
  rentalStartDelayMonths?: number;
  /** Annual rent escalation, whole percent. Default 0. */
  rentEscalationPct?: number;
  /** Annual expense inflation, whole percent. Default 0. */
  expenseInflationPct?: number;
  /** Annual property appreciation, whole percent. Default 0. */
  appreciationPct?: number;
  /** Capital expenditure by year (1-based year → OMR). */
  capexByYear?: Record<number, number>;
  /** Extra vacancy in a given year as a whole percent of that year's income (renovation…). */
  extraVacancyPctByYear?: Record<number, number>;
  /** Holding period in years, 1–30. */
  holdYears: number;
  /** When set, exit value = forward NOI / exit cap; otherwise appreciated value. */
  exitCapRatePct?: number;
  /** Sensitivity hook: scales the derived exit value by this whole percent (−10 = 10% weaker exit). */
  exitValueDeltaPct?: number;
  /** Selling costs as a whole percent of the exit value. Default 0. */
  sellingCostsPct?: number;
  /** Discount rate for NPV, whole percent. Default 8. */
  discountRatePct?: number;
  /** "annual" (default) or "monthly" rows. Monthly is intended for holds ≤ 5 years. */
  granularity?: "annual" | "monthly";
}

export interface ProjectionPeriod {
  /** 1-based period number (year or month depending on granularity). */
  period: number;
  /** Year this period belongs to (== period for annual granularity). */
  year: number;
  rentalIncomeOmr: number;
  vacancyLossOmr: number;
  operatingExpensesOmr: number;
  noiOmr: number;
  debtServiceOmr: number;
  capexOmr: number;
  /** Developer-plan instalments falling due this period. */
  plannedOutflowOmr: number;
  netCashFlowOmr: number;
  propertyValueOmr: number;
  loanBalanceOmr: number;
  equityOmr: number;
  /** Net sale proceeds land in the final period; 0 elsewhere. */
  saleProceedsOmr: number;
}

export interface ExitSummary {
  exitYear: number;
  /** Gross exit value (appreciated or cap-derived). */
  exitValueOmr: number;
  /** How the exit value was derived. */
  method: "appreciation" | "exit_cap";
  sellingCostsOmr: number;
  loanBalanceAtExitOmr: number;
  /**
   * Developer-plan instalments still owed AFTER the hold ends (selling before
   * the plan completes). Settled out of the sale — the seller only nets the
   * value above the remaining price obligation.
   */
  remainingPlanObligationOmr: number;
  netSaleProceedsOmr: number;
}

export interface ProjectionResult {
  periods: ProjectionPeriod[];
  exit: ExitSummary;
  /** Equity cash-flow vector (annual): [t0, year1, …, yearN incl. sale proceeds]. */
  equityFlowsOmr: number[];
  totalCashInOmr: number;
  totalCashOutOmr: number;
  totalProfitOmr: number;
  irrPct: number | null;
  npvOmr: number;
  equityMultiple: number | null;
  paybackYears: number | null;
  /** CAGR of property value from price to exit value. */
  valueCagrPct: number | null;
}

/** Fraction of a given year (1-based) that falls after `startMonths`. */
function activeFractionOfYear(year: number, startMonths: number): number {
  const yearStart = (year - 1) * 12;
  const yearEnd = year * 12;
  if (yearEnd <= startMonths) return 0;
  if (yearStart >= startMonths) return 1;
  return (yearEnd - startMonths) / 12;
}

/**
 * Builds the projection.
 *
 * Income model per year y (1-based):
 *   egi_y  = egi × (1+esc)^(y−1) × activeFraction(y) × (1 − extraVacancy_y)
 *   opex_y = opex × (1+infl)^(y−1) × activeFraction(y)
 * where activeFraction covers the off-plan period (handover + rental delay).
 * Operating costs are assumed to start with handover — service charges before
 * handover, if any, belong in the acquisition cost lines.
 *
 * Exit at the end of `holdYears`:
 *   appreciation method: price × (1+appr)^hold
 *   exit-cap method:     forward NOI (year hold+1, fully active) / exitCap
 * Net proceeds = exit value − selling costs − loan balance at exit.
 */
export function buildProjection(input: ProjectionInput): ProjectionResult {
  const {
    priceOmr,
    initialOutflowOmr,
    scheduledOutflows = [],
    loan = null,
    egiOmr,
    opexOmr,
    handoverMonths = 0,
    rentalStartDelayMonths = 0,
    rentEscalationPct = 0,
    expenseInflationPct = 0,
    appreciationPct = 0,
    capexByYear = {},
    extraVacancyPctByYear = {},
    exitCapRatePct,
    exitValueDeltaPct = 0,
    sellingCostsPct = 0,
    discountRatePct = 8,
    granularity = "annual",
  } = input;
  const holdYears = Math.max(1, Math.min(30, Math.round(input.holdYears)));

  const incomeStartMonths = Math.max(0, handoverMonths) + Math.max(0, rentalStartDelayMonths);
  const esc = d(rentEscalationPct).dividedBy(100).plus(1);
  const infl = d(expenseInflationPct).dividedBy(100).plus(1);
  const appr = d(appreciationPct).dividedBy(100).plus(1);

  // --- Annual skeleton (monthly granularity subdivides these figures).
  interface YearRow {
    egi: number;
    vacancyLoss: number;
    opex: number;
    noi: number;
    debtService: number;
    capex: number;
    planned: number;
    value: number;
    balance: number;
  }
  const years: YearRow[] = [];
  for (let y = 1; y <= holdYears; y++) {
    const active = activeFractionOfYear(y, incomeStartMonths);
    const extraVac = Math.min(100, Math.max(0, extraVacancyPctByYear[y] ?? 0));
    const potential = d(egiOmr).times(esc.pow(y - 1)).times(active);
    const egi = roundOMR(potential.times(d(1).minus(d(extraVac).dividedBy(100))));
    const vacancyLoss = roundOMR(potential.minus(egi));
    const opex = roundOMR(d(opexOmr).times(infl.pow(y - 1)).times(active));
    const noi = roundOMR(d(egi).minus(opex));
    const debtService = loan ? (loan.debtServiceByYearOmr[y - 1] ?? 0) : 0;
    const balance =
      loan == null
        ? 0
        : y - 1 < loan.balanceByYearOmr.length
          ? loan.balanceByYearOmr[y - 1]
          : 0; // fully repaid beyond the schedule
    const capex = roundOMR(capexByYear[y] ?? 0);
    const planned = roundOMR(
      scheduledOutflows
        .filter((o) => o.monthsFromStart > (y - 1) * 12 && o.monthsFromStart <= y * 12)
        .reduce((acc, o) => acc + o.amountOmr, 0),
    );
    const value = roundOMR(d(priceOmr).times(appr.pow(y)));
    years.push({ egi, vacancyLoss, opex, noi, debtService, capex, planned, value, balance });
  }

  // t0 scheduled outflows (month 0 = signing) join the initial outflow.
  const t0Planned = roundOMR(
    scheduledOutflows.filter((o) => o.monthsFromStart <= 0).reduce((acc, o) => acc + o.amountOmr, 0),
  );

  // --- Exit.
  const last = years[holdYears - 1];
  let exitValueOmr: number;
  let method: ExitSummary["method"];
  if (exitCapRatePct && exitCapRatePct > 0) {
    // Forward NOI: the year after exit, fully active, escalated.
    const fwdEgi = d(egiOmr).times(esc.pow(holdYears));
    const fwdOpex = d(opexOmr).times(infl.pow(holdYears));
    exitValueOmr = roundOMR(fwdEgi.minus(fwdOpex).dividedBy(d(exitCapRatePct).dividedBy(100)));
    method = "exit_cap";
  } else {
    exitValueOmr = last.value;
    method = "appreciation";
  }
  if (exitValueDeltaPct !== 0) {
    exitValueOmr = roundOMR(d(exitValueOmr).times(d(100).plus(exitValueDeltaPct).dividedBy(100)));
  }
  const sellingCostsOmr = roundOMR(d(exitValueOmr).times(sellingCostsPct).dividedBy(100));
  const loanBalanceAtExitOmr = last.balance;
  // Instalments falling due after the hold are still owed on the price — an
  // early exit settles them from the sale. Without this, selling before the
  // plan completes would book the full property value against a part-paid
  // price: phantom profit.
  const remainingPlanObligationOmr = roundOMR(
    scheduledOutflows
      .filter((o) => o.monthsFromStart > holdYears * 12)
      .reduce((acc, o) => acc + o.amountOmr, 0),
  );
  const netSaleProceedsOmr = roundOMR(
    d(exitValueOmr)
      .minus(sellingCostsOmr)
      .minus(loanBalanceAtExitOmr)
      .minus(remainingPlanObligationOmr),
  );
  const exit: ExitSummary = {
    exitYear: holdYears,
    exitValueOmr,
    method,
    sellingCostsOmr,
    loanBalanceAtExitOmr,
    remainingPlanObligationOmr,
    netSaleProceedsOmr,
  };

  // --- Equity cash-flow vector (annual, regardless of row granularity).
  const equityFlowsOmr: number[] = [roundOMR(-(initialOutflowOmr + t0Planned))];
  for (let y = 1; y <= holdYears; y++) {
    const r = years[y - 1];
    let flow = d(r.noi).minus(r.debtService).minus(r.capex).minus(r.planned);
    if (y === holdYears) flow = flow.plus(netSaleProceedsOmr);
    equityFlowsOmr.push(roundOMR(flow));
  }

  const totalCashInOmr = roundOMR(
    equityFlowsOmr.filter((f) => f < 0).reduce((acc, f) => acc - f, 0),
  );
  const totalCashOutOmr = roundOMR(
    equityFlowsOmr.filter((f) => f > 0).reduce((acc, f) => acc + f, 0),
  );

  // --- Period rows.
  const periods: ProjectionPeriod[] = [];
  if (granularity === "annual") {
    for (let y = 1; y <= holdYears; y++) {
      const r = years[y - 1];
      periods.push({
        period: y,
        year: y,
        rentalIncomeOmr: r.egi,
        vacancyLossOmr: r.vacancyLoss,
        operatingExpensesOmr: r.opex,
        noiOmr: r.noi,
        debtServiceOmr: r.debtService,
        capexOmr: r.capex,
        plannedOutflowOmr: r.planned,
        netCashFlowOmr: roundOMR(
          d(r.noi).minus(r.debtService).minus(r.capex).minus(r.planned),
        ),
        propertyValueOmr: r.value,
        loanBalanceOmr: r.balance,
        equityOmr: roundOMR(d(r.value).minus(r.balance)),
        saleProceedsOmr: y === holdYears ? netSaleProceedsOmr : 0,
      });
    }
  } else {
    // Monthly rows: annual figures divided over the year's income-active
    // months; debt service and instalments land in their true months. The
    // divisor counts months on the SAME integer grid as monthActive so the
    // monthly rows always reconcile with the annual figures, including
    // fractional handover offsets.
    const gridStart = Math.floor(incomeStartMonths);
    for (let y = 1; y <= holdYears; y++) {
      const r = years[y - 1];
      for (let m = 1; m <= 12; m++) {
        const monthIndex = (y - 1) * 12 + m;
        const monthActive = monthIndex > incomeStartMonths;
        const activeMonthsInYear = Math.max(0, y * 12 - Math.max((y - 1) * 12, gridStart));
        const per = (annual: number) =>
          monthActive && activeMonthsInYear > 0 ? roundOMR(d(annual).dividedBy(activeMonthsInYear)) : 0;
        const debtService = loan
          ? roundOMR(
              loan.periods
                .filter((p) => p.phase !== "grace" && p.monthsFromStart > monthIndex - 1 && p.monthsFromStart <= monthIndex)
                .reduce((acc, p) => acc + p.paymentOmr, 0),
            )
          : 0;
        const planned = roundOMR(
          scheduledOutflows
            .filter((o) => o.monthsFromStart > monthIndex - 1 && o.monthsFromStart <= monthIndex)
            .reduce((acc, o) => acc + o.amountOmr, 0),
        );
        const capex = m === 12 ? r.capex : 0;
        const income = per(r.egi);
        const opex = per(r.opex);
        const noi = roundOMR(d(income).minus(opex));
        const isFinal = y === holdYears && m === 12;
        periods.push({
          period: monthIndex,
          year: y,
          rentalIncomeOmr: income,
          vacancyLossOmr: per(r.vacancyLoss),
          operatingExpensesOmr: opex,
          noiOmr: noi,
          debtServiceOmr: debtService,
          capexOmr: capex,
          plannedOutflowOmr: planned,
          netCashFlowOmr: roundOMR(d(noi).minus(debtService).minus(capex).minus(planned)),
          propertyValueOmr: m === 12 ? r.value : 0,
          loanBalanceOmr: m === 12 ? r.balance : 0,
          equityOmr: m === 12 ? roundOMR(d(r.value).minus(r.balance)) : 0,
          saleProceedsOmr: isFinal ? netSaleProceedsOmr : 0,
        });
      }
    }
  }

  return {
    periods,
    exit,
    equityFlowsOmr,
    totalCashInOmr,
    totalCashOutOmr,
    totalProfitOmr: roundOMR(d(totalCashOutOmr).minus(totalCashInOmr)),
    irrPct: irrPct(equityFlowsOmr),
    npvOmr: npvOmr(discountRatePct, equityFlowsOmr),
    equityMultiple: equityMultiple(totalCashOutOmr, totalCashInOmr),
    paybackYears: paybackYears(equityFlowsOmr),
    valueCagrPct: cagrPct(priceOmr, exitValueOmr, holdYears),
  };
}
