// Investment-analysis orchestrator: composes acquisition, rental strategies,
// financing, projection, metrics, qualification, the offer-price solver and
// scenario/sensitivity sweeps into ONE structured, reproducible result.
//
// Pure and deterministic — this module is the single source of financial
// truth. The AI layer receives the result JSON and may only narrate it; the
// UI renders it; persistence snapshots it together with the input so a saved
// report replays exactly. FORMULA_VERSION is stamped on every result.
import {
  paymentPlan,
  residencyTier,
  type ResidencyTierResult,
} from "../calculators";
import { acquisitionCosts, roundPct, type AcquisitionResult, type CostLine } from "./acquisition";
import { buildLoanSchedule, loanToValuePct, type LoanInput, type LoanSchedule } from "./financing";
import {
  annualStrategy,
  blendStrategies,
  dailyStrategy,
  monthlyStrategy,
  type AnnualStrategyInput,
  type DailyStrategyInput,
  type MonthlyStrategyInput,
  type StrategyResult,
  type StrategyType,
} from "./rental";
import {
  breakEvenOccupancyPct,
  capRatePct,
  cashOnCashPct,
  debtYieldPct,
  dscr,
  grossYieldPct,
  netYieldPct,
} from "./metrics";
import { buildProjection, type ProjectionResult, type ScheduledOutflow } from "./projection";
import {
  qualify,
  type ObjectiveProfile,
  type QualificationResult,
} from "./objectives";
import { solveOffer, type OfferRecommendation, type OfferTarget, type PricePointMetrics } from "./offerSolver";
import { summarizeComparables, type ComparableProperty, type ComparableSummary } from "./comparables";
import {
  runScenarios,
  runSensitivity,
  SCENARIO_PRESETS,
  DEFAULT_SENSITIVITY_VARIABLES,
  type ScenarioAdjustments,
  type ScenarioOutcome,
  type ScenarioResult,
  type SensitivityResult,
} from "./scenarios";
import { summarizeDataQuality, type DataQualitySummary, type SourcedValue } from "./provenance";
import { d, roundOMR } from "../../money";

/** Bumped whenever a formula changes so old saved reports stay interpretable. */
export const FORMULA_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface PropertyInput {
  name?: string;
  project?: string;
  developer?: string;
  reference?: string;
  unitType?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm: number;
  landAreaSqm?: number | null;
  floor?: string;
  completionStatus: "ready" | "off_plan";
  /** Months until handover for off-plan; ignored when ready. */
  handoverMonths?: number;
  completionDate?: string;
  furnishing?: "furnished" | "semi_furnished" | "unfurnished" | "unknown";
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  category?: "ITC" | "future_cities" | "surooh";
  ownershipEligibility?: "all_nationalities" | "gcc_omani_only";
  askingPriceOmr: number;
  /** When set, the analysis runs at this price instead of asking. */
  negotiatedPriceOmr?: number | null;
  /** Owner's current market-value estimate; cap rate uses it when present. */
  marketValueOmr?: number | null;
  dataSource?: string;
  verifiedAt?: string;
}

export interface AnalysisFinancingInput {
  mode: "cash" | "mortgage" | "payment_plan";
  /** Mortgage: loan = explicit amount, else price × ltvPct/100. */
  loanOmr?: number;
  ltvPct?: number;
  annualRatePct?: number;
  termYears?: number;
  paymentsPerYear?: 12 | 4;
  graceMonths?: number;
  interestOnlyMonths?: number;
  balloonOmr?: number;
  mortgageFeesOmr?: number;
  /** Developer plan (percent-driven, scales with price). */
  plan?: {
    reservationPct?: number;
    reservationOmr?: number;
    downPct?: number;
    years?: number;
    installmentsPerYear?: number;
  };
}

export interface AnalysisProjectionInput {
  holdYears: number;
  rentEscalationPct?: number;
  expenseInflationPct?: number;
  appreciationPct?: number;
  exitCapRatePct?: number;
  sellingCostsPct?: number;
  discountRatePct?: number;
  rentalStartDelayMonths?: number;
  capexByYear?: Record<number, number>;
  extraVacancyPctByYear?: Record<number, number>;
  granularity?: "annual" | "monthly";
}

export interface InvestmentAnalysisInput {
  property: PropertyInput;
  acquisition: { costLines: CostLine[]; contingencyPct?: number };
  strategies: {
    daily?: DailyStrategyInput;
    monthly?: MonthlyStrategyInput;
    annual?: AnnualStrategyInput;
    /** Time shares for the blended view, whole percents (e.g. { daily: 40, annual: 60 }). */
    blendSharesPct?: Partial<Record<StrategyType, number>>;
  };
  /** Which strategy drives the projection and headline metrics. */
  activeStrategy: StrategyType | "blended";
  financing: AnalysisFinancingInput;
  projection: AnalysisProjectionInput;
  objectives?: ObjectiveProfile;
  objectiveWeights?: Record<string, number>;
  /** Explicit solver targets; derived from objectives when absent. */
  offerTargets?: OfferTarget[];
  comparables?: ComparableProperty[];
  /** Provenance-tracked fields from the UI; drives the data-quality score. */
  trackedFields?: SourcedValue[];
  /** Skip the heavier sweeps (used by nested evaluations). */
  lean?: boolean;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface ExplainEntry {
  metric: string;
  formula: string;
  inputs: Record<string, number | string | null>;
  steps: string[];
  result: number | string | null;
}

export interface HeadlineMetrics {
  analysisPriceOmr: number;
  grossYieldPct: number | null;
  netYieldPct: number | null;
  capRatePct: number | null;
  noiOmr: number;
  effectiveGrossIncomeOmr: number;
  operatingExpensesOmr: number;
  annualDebtServiceOmr: number;
  annualCashFlowOmr: number;
  monthlyCashFlowOmr: number;
  cashOnCashPct: number | null;
  dscr: number | null;
  debtYieldPct: number | null;
  ltvPct: number | null;
  breakEvenOccupancyPct: number | null;
  operatingExpenseRatioPct: number | null;
  profitPerSqmOmr: number | null;
  returnPerSqmOmr: number | null;
}

export interface InvestmentAnalysisResult {
  formulaVersion: string;
  currency: "OMR";
  property: PropertyInput;
  analysisPriceOmr: number;
  acquisition: AcquisitionResult;
  strategies: StrategyResult[];
  activeStrategy: StrategyResult;
  financing: {
    mode: AnalysisFinancingInput["mode"];
    loanOmr: number;
    schedule: LoanSchedule | null;
    scheduledOutflows: ScheduledOutflow[];
  };
  metrics: HeadlineMetrics;
  projection: ProjectionResult;
  residency: ResidencyTierResult;
  qualification: QualificationResult;
  offer: OfferRecommendation | null;
  scenarios: ScenarioResult[];
  sensitivity: SensitivityResult | null;
  comparableSummary: ComparableSummary | null;
  dataQuality: DataQualitySummary;
  explains: ExplainEntry[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Core pipeline (single price, no sweeps) — reused by solver & scenarios
// ---------------------------------------------------------------------------

interface CoreResult {
  price: number;
  acquisition: AcquisitionResult;
  strategies: StrategyResult[];
  active: StrategyResult;
  loanOmr: number;
  schedule: LoanSchedule | null;
  scheduledOutflows: ScheduledOutflow[];
  annualDebtServiceOmr: number;
  projection: ProjectionResult;
  metrics: HeadlineMetrics;
  warnings: string[];
}

function computeStrategies(input: InvestmentAnalysisInput): {
  all: StrategyResult[];
  active: StrategyResult;
  warnings: string[];
} {
  const warnings: string[] = [];
  const all: StrategyResult[] = [];
  const byType: Partial<Record<StrategyType, StrategyResult>> = {};

  if (input.strategies.daily) {
    byType.daily = dailyStrategy(input.strategies.daily);
    all.push(byType.daily);
  }
  if (input.strategies.monthly) {
    byType.monthly = monthlyStrategy(input.strategies.monthly);
    all.push(byType.monthly);
  }
  if (input.strategies.annual) {
    byType.annual = annualStrategy(input.strategies.annual);
    all.push(byType.annual);
  }

  let active: StrategyResult | undefined;
  if (input.activeStrategy === "blended") {
    const shares = input.strategies.blendSharesPct ?? {};
    const components = (Object.keys(shares) as StrategyType[])
      .filter((k) => byType[k] && (shares[k] ?? 0) > 0)
      .map((k) => ({ result: byType[k] as StrategyResult, sharePct: shares[k] as number }));
    active = blendStrategies(components) ?? undefined;
    if (!active) warnings.push("Blended strategy selected but no blend shares were usable; fell back to the first configured strategy.");
    if (active) all.push(active);
  } else {
    active = byType[input.activeStrategy];
    if (!active) warnings.push(`Active strategy "${input.activeStrategy}" has no inputs; fell back to the first configured strategy.`);
  }
  if (!active) active = all[0];
  if (!active) {
    // Nothing configured at all: a zero-income placeholder keeps the pipeline
    // total (metrics will be null/negative and qualification will say so).
    active = annualStrategy({ annualRentOmr: 0 });
    all.push(active);
    warnings.push("No rental strategy configured — income figures are zero until one is entered.");
  }
  return { all, active, warnings };
}

function computeCore(input: InvestmentAnalysisInput): CoreResult {
  const warnings: string[] = [];
  const price =
    input.property.negotiatedPriceOmr != null && input.property.negotiatedPriceOmr > 0
      ? input.property.negotiatedPriceOmr
      : input.property.askingPriceOmr;

  // --- Financing.
  const fin = input.financing;
  let loanOmr = 0;
  let schedule: LoanSchedule | null = null;
  let scheduledOutflows: ScheduledOutflow[] = [];
  if (fin.mode === "mortgage") {
    loanOmr =
      fin.loanOmr != null && fin.loanOmr > 0
        ? fin.loanOmr
        : roundOMR(d(price).times(fin.ltvPct ?? 0).dividedBy(100));
    if (loanOmr > 0) {
      const loanInput: LoanInput = {
        principalOmr: loanOmr,
        annualRatePct: fin.annualRatePct ?? 0,
        termYears: fin.termYears ?? 20,
        paymentsPerYear: fin.paymentsPerYear ?? 12,
        graceMonths: fin.graceMonths ?? 0,
        interestOnlyMonths: fin.interestOnlyMonths ?? 0,
        balloonOmr: fin.balloonOmr ?? 0,
        feesOmr: fin.mortgageFeesOmr ?? 0,
      };
      schedule = buildLoanSchedule(loanInput);
    } else {
      warnings.push("Mortgage mode selected but loan amount resolves to 0 — treated as cash.");
    }
  } else if (fin.mode === "payment_plan") {
    const plan = paymentPlan({
      priceOmr: price,
      reservationOmr: fin.plan?.reservationOmr,
      reservationPct: fin.plan?.reservationPct,
      downPct: fin.plan?.downPct,
      years: fin.plan?.years,
      installmentsPerYear: fin.plan?.installmentsPerYear,
    });
    scheduledOutflows = plan.schedule.map((s) => ({
      monthsFromStart: s.dueMonthsFromNow,
      amountOmr: s.amountOmr,
      label: s.label,
    }));
  }

  // --- Acquisition. For a payment plan the price is paid via the schedule, so
  // the financed amount is 0 and the projection carries the instalments.
  const acquisition = acquisitionCosts({
    priceOmr: price,
    costLines: input.acquisition.costLines,
    contingencyPct: input.acquisition.contingencyPct,
    financedOmr: fin.mode === "mortgage" ? loanOmr : 0,
    areaSqm: input.property.areaSqm,
  });

  // --- Strategies.
  const { all, active, warnings: stratWarnings } = computeStrategies(input);
  warnings.push(...stratWarnings);

  // --- Projection.
  const handoverMonths =
    input.property.completionStatus === "off_plan" ? Math.max(0, input.property.handoverMonths ?? 0) : 0;
  // Payment plans: t0 outflow = acquisition extras only (instalments are scheduled).
  const initialOutflowOmr =
    fin.mode === "payment_plan"
      ? roundOMR(d(acquisition.itemizedCostsOmr).plus(acquisition.contingencyOmr))
      : acquisition.totalCashRequiredOmr;

  const projection = buildProjection({
    priceOmr: price,
    initialOutflowOmr,
    scheduledOutflows,
    loan: schedule,
    egiOmr: active.effectiveGrossIncomeOmr,
    opexOmr: active.operatingExpensesOmr,
    handoverMonths,
    rentalStartDelayMonths: input.projection.rentalStartDelayMonths ?? 0,
    rentEscalationPct: input.projection.rentEscalationPct ?? 0,
    expenseInflationPct: input.projection.expenseInflationPct ?? 0,
    appreciationPct: input.projection.appreciationPct ?? 0,
    capexByYear: input.projection.capexByYear ?? {},
    extraVacancyPctByYear: input.projection.extraVacancyPctByYear ?? {},
    holdYears: input.projection.holdYears,
    exitCapRatePct: input.projection.exitCapRatePct,
    sellingCostsPct: input.projection.sellingCostsPct ?? 0,
    discountRatePct: input.projection.discountRatePct ?? 8,
    granularity: input.projection.granularity ?? "annual",
  });

  // --- Stabilized year-1 headline metrics.
  const annualDebtServiceOmr = schedule ? schedule.stabilizedAnnualDebtServiceOmr : 0;
  const annualCashFlowOmr = roundOMR(d(active.noiOmr).minus(annualDebtServiceOmr));
  const totalCash =
    fin.mode === "payment_plan" ? projection.totalCashInOmr : acquisition.totalCashRequiredOmr;
  const valueBasis =
    input.property.marketValueOmr != null && input.property.marketValueOmr > 0
      ? input.property.marketValueOmr
      : price;

  const profitPerSqm =
    input.property.areaSqm > 0
      ? roundOMR(d(projection.totalProfitOmr).dividedBy(input.property.areaSqm))
      : null;

  const metrics: HeadlineMetrics = {
    analysisPriceOmr: price,
    grossYieldPct: grossYieldPct(active.grossPotentialIncomeOmr, price),
    netYieldPct: netYieldPct(active.noiOmr, price),
    capRatePct: capRatePct(active.noiOmr, valueBasis),
    noiOmr: active.noiOmr,
    effectiveGrossIncomeOmr: active.effectiveGrossIncomeOmr,
    operatingExpensesOmr: active.operatingExpensesOmr,
    annualDebtServiceOmr,
    annualCashFlowOmr,
    monthlyCashFlowOmr: roundOMR(d(annualCashFlowOmr).dividedBy(12)),
    cashOnCashPct: cashOnCashPct(annualCashFlowOmr, totalCash),
    dscr: dscr(active.noiOmr, annualDebtServiceOmr),
    debtYieldPct: schedule ? debtYieldPct(active.noiOmr, schedule.capitalizedPrincipalOmr) : null,
    ltvPct: loanOmr > 0 ? loanToValuePct(loanOmr, valueBasis) : null,
    breakEvenOccupancyPct: breakEvenOccupancyPct(
      active.operatingExpensesOmr,
      annualDebtServiceOmr,
      active.otherIncomeOmr,
      active.grossPotentialIncomeOmr,
    ),
    operatingExpenseRatioPct: active.operatingExpenseRatioPct,
    profitPerSqmOmr: profitPerSqm,
    returnPerSqmOmr:
      input.property.areaSqm > 0 ? roundOMR(d(active.noiOmr).dividedBy(input.property.areaSqm)) : null,
  };

  return {
    price,
    acquisition,
    strategies: all,
    active,
    loanOmr,
    schedule,
    scheduledOutflows,
    annualDebtServiceOmr,
    projection,
    metrics,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Adjustments (scenarios / sensitivity)
// ---------------------------------------------------------------------------

const pctFactor = (deltaPct?: number) => 1 + (deltaPct ?? 0) / 100;
const clampPct = (v: number) => Math.min(100, Math.max(0, v));

/** Applies scenario deltas to a deep-adjusted copy of the input. Pure. */
export function applyAdjustments(
  base: InvestmentAnalysisInput,
  adj: ScenarioAdjustments,
): InvestmentAnalysisInput {
  const rentF = pctFactor(adj.rentDeltaPct);
  const expF = pctFactor(adj.expensesDeltaPct);
  const occD = adj.occupancyDeltaPts ?? 0;

  const daily: DailyStrategyInput | undefined = base.strategies.daily
    ? {
        ...base.strategies.daily,
        adrOmr: base.strategies.daily.adrOmr * rentF,
        occupancyPct: clampPct(base.strategies.daily.occupancyPct + occD),
        seasonality: base.strategies.daily.seasonality?.map((m) => ({
          adrOmr: m.adrOmr * rentF,
          occupancyPct: clampPct(m.occupancyPct + occD),
        })),
        utilitiesOmr: (base.strategies.daily.utilitiesOmr ?? 0) * expF,
        internetOmr: (base.strategies.daily.internetOmr ?? 0) * expF,
        consumablesOmr: (base.strategies.daily.consumablesOmr ?? 0) * expF,
        linenHousekeepingOmr: (base.strategies.daily.linenHousekeepingOmr ?? 0) * expF,
        maintenanceOmr: (base.strategies.daily.maintenanceOmr ?? 0) * expF,
        replacementReserveOmr: (base.strategies.daily.replacementReserveOmr ?? 0) * expF,
        serviceChargeOmr: (base.strategies.daily.serviceChargeOmr ?? 0) * expF,
        insuranceOmr: (base.strategies.daily.insuranceOmr ?? 0) * expF,
        otherExpensesOmr: (base.strategies.daily.otherExpensesOmr ?? 0) * expF,
        cleaningCostOmr: (base.strategies.daily.cleaningCostOmr ?? 0) * expF,
      }
    : undefined;

  const monthly: MonthlyStrategyInput | undefined = base.strategies.monthly
    ? {
        ...base.strategies.monthly,
        monthlyRentOmr: base.strategies.monthly.monthlyRentOmr * rentF,
        vacancyPct: clampPct((base.strategies.monthly.vacancyPct ?? 0) - occD),
        utilitiesOmr: (base.strategies.monthly.utilitiesOmr ?? 0) * expF,
        maintenanceOmr: (base.strategies.monthly.maintenanceOmr ?? 0) * expF,
        serviceChargeOmr: (base.strategies.monthly.serviceChargeOmr ?? 0) * expF,
        insuranceOmr: (base.strategies.monthly.insuranceOmr ?? 0) * expF,
        replacementReserveOmr: (base.strategies.monthly.replacementReserveOmr ?? 0) * expF,
        otherExpensesOmr: (base.strategies.monthly.otherExpensesOmr ?? 0) * expF,
      }
    : undefined;

  const annual: AnnualStrategyInput | undefined = base.strategies.annual
    ? {
        ...base.strategies.annual,
        annualRentOmr: base.strategies.annual.annualRentOmr * rentF,
        vacancyAllowancePct: clampPct((base.strategies.annual.vacancyAllowancePct ?? 0) - occD),
        renewalCostsOmr: (base.strategies.annual.renewalCostsOmr ?? 0) * expF,
        serviceChargeOmr: (base.strategies.annual.serviceChargeOmr ?? 0) * expF,
        insuranceOmr: (base.strategies.annual.insuranceOmr ?? 0) * expF,
        maintenanceOmr: (base.strategies.annual.maintenanceOmr ?? 0) * expF,
        replacementReserveOmr: (base.strategies.annual.replacementReserveOmr ?? 0) * expF,
        otherExpensesOmr: (base.strategies.annual.otherExpensesOmr ?? 0) * expF,
      }
    : undefined;

  const priceF = pctFactor(adj.priceDeltaPct);
  const holdYears = Math.min(30, Math.max(1, base.projection.holdYears + (adj.holdDeltaYears ?? 0)));

  return {
    ...base,
    property: {
      ...base.property,
      askingPriceOmr: base.property.askingPriceOmr,
      negotiatedPriceOmr:
        (base.property.negotiatedPriceOmr != null && base.property.negotiatedPriceOmr > 0
          ? base.property.negotiatedPriceOmr
          : base.property.askingPriceOmr) * priceF,
      handoverMonths: (base.property.handoverMonths ?? 0) + (adj.completionDelayMonths ?? 0),
    },
    financing: {
      ...base.financing,
      annualRatePct:
        base.financing.annualRatePct != null
          ? Math.max(0, base.financing.annualRatePct + (adj.interestDeltaPts ?? 0))
          : base.financing.annualRatePct,
    },
    strategies: { ...base.strategies, daily, monthly, annual },
    projection: {
      ...base.projection,
      holdYears,
      appreciationPct: (base.projection.appreciationPct ?? 0) + (adj.appreciationDeltaPts ?? 0),
    },
    lean: true,
  };
}

function outcomeOf(core: CoreResult): ScenarioOutcome {
  return {
    irrPct: core.projection.irrPct,
    cashOnCashPct: core.metrics.cashOnCashPct,
    netYieldPct: core.metrics.netYieldPct,
    monthlyCashFlowOmr: core.metrics.monthlyCashFlowOmr,
    npvOmr: core.projection.npvOmr,
    totalProfitOmr: core.projection.totalProfitOmr,
  };
}

// ---------------------------------------------------------------------------
// Explain
// ---------------------------------------------------------------------------

function buildExplains(core: CoreResult): ExplainEntry[] {
  const m = core.metrics;
  const s = core.active;
  const entries: ExplainEntry[] = [
    {
      metric: "Effective gross income",
      formula: "gross potential income − vacancy loss + other operating income",
      inputs: {
        grossPotentialIncomeOmr: s.grossPotentialIncomeOmr,
        vacancyLossOmr: s.vacancyLossOmr,
        otherIncomeOmr: s.otherIncomeOmr,
      },
      steps: [
        `${s.grossPotentialIncomeOmr} − ${s.vacancyLossOmr} + ${s.otherIncomeOmr} = ${s.effectiveGrossIncomeOmr} OMR`,
      ],
      result: s.effectiveGrossIncomeOmr,
    },
    {
      metric: "Net operating income",
      formula: "effective gross income − operating expenses",
      inputs: {
        effectiveGrossIncomeOmr: s.effectiveGrossIncomeOmr,
        operatingExpensesOmr: s.operatingExpensesOmr,
      },
      steps: [`${s.effectiveGrossIncomeOmr} − ${s.operatingExpensesOmr} = ${s.noiOmr} OMR`],
      result: s.noiOmr,
    },
    {
      metric: "Gross rental yield",
      formula: "annual gross rental income ÷ analysis price × 100",
      inputs: { grossPotentialIncomeOmr: s.grossPotentialIncomeOmr, analysisPriceOmr: m.analysisPriceOmr },
      steps: [
        m.grossYieldPct != null
          ? `${s.grossPotentialIncomeOmr} ÷ ${m.analysisPriceOmr} × 100 = ${m.grossYieldPct}%`
          : "Analysis price is 0 — yield undefined.",
      ],
      result: m.grossYieldPct,
    },
    {
      metric: "Net rental yield",
      formula: "NOI ÷ analysis price × 100",
      inputs: { noiOmr: s.noiOmr, analysisPriceOmr: m.analysisPriceOmr },
      steps: [
        m.netYieldPct != null
          ? `${s.noiOmr} ÷ ${m.analysisPriceOmr} × 100 = ${m.netYieldPct}%`
          : "Analysis price is 0 — yield undefined.",
      ],
      result: m.netYieldPct,
    },
    {
      metric: "Cash-on-cash return",
      formula: "annual pre-tax cash flow ÷ total cash invested × 100",
      inputs: {
        annualCashFlowOmr: m.annualCashFlowOmr,
        totalCashInvestedOmr: core.acquisition.totalCashRequiredOmr,
      },
      steps: [
        m.cashOnCashPct != null
          ? `(${m.noiOmr} NOI − ${m.annualDebtServiceOmr} debt service) ÷ ${core.acquisition.totalCashRequiredOmr} × 100 = ${m.cashOnCashPct}%`
          : "Total cash invested is 0 — return undefined.",
      ],
      result: m.cashOnCashPct,
    },
    {
      metric: "DSCR",
      formula: "NOI ÷ annual debt service",
      inputs: { noiOmr: s.noiOmr, annualDebtServiceOmr: m.annualDebtServiceOmr },
      steps: [
        m.dscr != null
          ? `${s.noiOmr} ÷ ${m.annualDebtServiceOmr} = ${m.dscr}`
          : "No debt service — DSCR does not apply to an unleveraged deal.",
      ],
      result: m.dscr,
    },
    {
      metric: "Break-even occupancy",
      formula: "(operating expenses + debt service − other income) ÷ gross potential income × 100",
      inputs: {
        operatingExpensesOmr: s.operatingExpensesOmr,
        annualDebtServiceOmr: m.annualDebtServiceOmr,
        otherIncomeOmr: s.otherIncomeOmr,
        grossPotentialIncomeOmr: s.grossPotentialIncomeOmr,
      },
      steps: [
        m.breakEvenOccupancyPct != null
          ? `(${s.operatingExpensesOmr} + ${m.annualDebtServiceOmr} − ${s.otherIncomeOmr}) ÷ ${s.grossPotentialIncomeOmr} × 100 = ${m.breakEvenOccupancyPct}%`
          : "No gross potential income — break-even occupancy undefined.",
      ],
      result: m.breakEvenOccupancyPct,
    },
    {
      metric: "IRR",
      formula: "rate where NPV(equity cash flows) = 0 — bisection, annual flows",
      inputs: { flows: core.projection.equityFlowsOmr.map((f) => Math.round(f)).join(", ") },
      steps: [
        core.projection.irrPct != null
          ? `Equity flows [${core.projection.equityFlowsOmr.map((f) => Math.round(f)).join(", ")}] → IRR ${core.projection.irrPct}%`
          : "Cash flows never change sign — IRR undefined.",
      ],
      result: core.projection.irrPct,
    },
    {
      metric: "Exit / net sale proceeds",
      formula:
        core.projection.exit.method === "exit_cap"
          ? "forward NOI ÷ exit cap − selling costs − loan balance"
          : "price × (1+appreciation)^hold − selling costs − loan balance",
      inputs: {
        exitValueOmr: core.projection.exit.exitValueOmr,
        sellingCostsOmr: core.projection.exit.sellingCostsOmr,
        loanBalanceAtExitOmr: core.projection.exit.loanBalanceAtExitOmr,
      },
      steps: [
        `${core.projection.exit.exitValueOmr} − ${core.projection.exit.sellingCostsOmr} − ${core.projection.exit.loanBalanceAtExitOmr} = ${core.projection.exit.netSaleProceedsOmr} OMR`,
      ],
      result: core.projection.exit.netSaleProceedsOmr,
    },
  ];
  return entries;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/** Derives solver targets from the objective profile when none are explicit. */
function deriveOfferTargets(p: ObjectiveProfile | undefined): OfferTarget[] {
  if (!p) return [];
  const targets: OfferTarget[] = [];
  if (p.minGrossYieldPct != null) targets.push({ key: "grossYield", value: p.minGrossYieldPct });
  if (p.minNetYieldPct != null) targets.push({ key: "netYield", value: p.minNetYieldPct });
  if (p.minCashOnCashPct != null) targets.push({ key: "cashOnCash", value: p.minCashOnCashPct });
  if (p.minIrrPct != null) targets.push({ key: "irr", value: p.minIrrPct });
  if (p.minMonthlyCashFlowOmr != null)
    targets.push({ key: "monthlyCashFlow", value: p.minMonthlyCashFlowOmr });
  if (p.maxInitialCashOmr != null) targets.push({ key: "affordability", value: p.maxInitialCashOmr });
  return targets;
}

/**
 * Runs the full analysis. Deterministic: identical input → identical result.
 * `lean: true` (used internally for solver/scenario evaluations) skips the
 * solver, scenarios, sensitivity, qualification and explain layers.
 */
export function runInvestmentAnalysis(input: InvestmentAnalysisInput): InvestmentAnalysisResult {
  const core = computeCore(input);
  const warnings = [...core.warnings];

  const residency = residencyTier({ priceOmr: core.price });

  // --- Data quality: caller-tracked fields, else a minimal auto-derived set.
  const tracked: SourcedValue[] =
    input.trackedFields && input.trackedFields.length > 0
      ? input.trackedFields
      : autoTrackedFields(input);
  const dataQuality = summarizeDataQuality(tracked);

  // --- Comparables.
  const comparableSummary =
    input.comparables && input.comparables.length > 0
      ? summarizeComparables(input.comparables, {
          areaSqm: input.property.areaSqm,
          priceOmr: core.price,
        })
      : null;

  if (input.lean) {
    return {
      formulaVersion: FORMULA_VERSION,
      currency: "OMR",
      property: input.property,
      analysisPriceOmr: core.price,
      acquisition: core.acquisition,
      strategies: core.strategies,
      activeStrategy: core.active,
      financing: {
        mode: input.financing.mode,
        loanOmr: core.loanOmr,
        schedule: core.schedule,
        scheduledOutflows: core.scheduledOutflows,
      },
      metrics: core.metrics,
      projection: core.projection,
      residency,
      qualification: qualify(qualificationInputs(core, input, dataQuality.score), input.objectives ?? {}),
      offer: null,
      scenarios: [],
      sensitivity: null,
      comparableSummary,
      dataQuality,
      explains: [],
      warnings,
    };
  }

  // --- Qualification.
  const qualification = qualify(
    qualificationInputs(core, input, dataQuality.score),
    input.objectives ?? {},
    input.objectiveWeights,
  );

  // --- Offer solver (re-evaluates the core pipeline at candidate prices).
  const targets = input.offerTargets ?? deriveOfferTargets(input.objectives);
  let offer: OfferRecommendation | null = null;
  if (targets.length > 0) {
    const evaluate = (priceOmr: number): PricePointMetrics => {
      const at = computeCore({
        ...input,
        lean: true,
        property: { ...input.property, negotiatedPriceOmr: priceOmr },
      });
      return {
        grossYieldPct: at.metrics.grossYieldPct,
        netYieldPct: at.metrics.netYieldPct,
        capRatePct: at.metrics.capRatePct,
        cashOnCashPct: at.metrics.cashOnCashPct,
        irrPct: at.projection.irrPct,
        monthlyCashFlowOmr: at.metrics.monthlyCashFlowOmr,
        totalCashRequiredOmr: at.acquisition.totalCashRequiredOmr,
      };
    };
    offer = solveOffer({
      askingPriceOmr: input.property.askingPriceOmr,
      negotiatedPriceOmr: input.property.negotiatedPriceOmr ?? null,
      targets,
      evaluate,
    });
  }

  // --- Scenarios + sensitivity share one adjusted-evaluation closure.
  const evaluateAdjusted = (adj: ScenarioAdjustments): ScenarioOutcome => {
    const adjusted = applyAdjustments(input, adj);
    const core2 = computeCore(adjusted);
    if (adj.exitValueDeltaPct) {
      // Re-run projection with the exit delta applied (kept out of applyAdjustments
      // because the delta belongs to the projection, not the assumptions).
      const reprojected = buildProjection({
        priceOmr: core2.price,
        initialOutflowOmr:
          input.financing.mode === "payment_plan"
            ? roundOMR(d(core2.acquisition.itemizedCostsOmr).plus(core2.acquisition.contingencyOmr))
            : core2.acquisition.totalCashRequiredOmr,
        scheduledOutflows: core2.scheduledOutflows,
        loan: core2.schedule,
        egiOmr: core2.active.effectiveGrossIncomeOmr,
        opexOmr: core2.active.operatingExpensesOmr,
        handoverMonths:
          adjusted.property.completionStatus === "off_plan"
            ? Math.max(0, adjusted.property.handoverMonths ?? 0)
            : 0,
        rentalStartDelayMonths: adjusted.projection.rentalStartDelayMonths ?? 0,
        rentEscalationPct: adjusted.projection.rentEscalationPct ?? 0,
        expenseInflationPct: adjusted.projection.expenseInflationPct ?? 0,
        appreciationPct: adjusted.projection.appreciationPct ?? 0,
        capexByYear: adjusted.projection.capexByYear ?? {},
        extraVacancyPctByYear: adjusted.projection.extraVacancyPctByYear ?? {},
        holdYears: adjusted.projection.holdYears,
        exitCapRatePct: adjusted.projection.exitCapRatePct,
        exitValueDeltaPct: adj.exitValueDeltaPct,
        sellingCostsPct: adjusted.projection.sellingCostsPct ?? 0,
        discountRatePct: adjusted.projection.discountRatePct ?? 8,
      });
      return {
        irrPct: reprojected.irrPct,
        cashOnCashPct: core2.metrics.cashOnCashPct,
        netYieldPct: core2.metrics.netYieldPct,
        monthlyCashFlowOmr: core2.metrics.monthlyCashFlowOmr,
        npvOmr: reprojected.npvOmr,
        totalProfitOmr: reprojected.totalProfitOmr,
      };
    }
    return outcomeOf(core2);
  };

  const scenarios = runScenarios(SCENARIO_PRESETS, evaluateAdjusted);
  const sensitivity = runSensitivity(DEFAULT_SENSITIVITY_VARIABLES, evaluateAdjusted);

  return {
    formulaVersion: FORMULA_VERSION,
    currency: "OMR",
    property: input.property,
    analysisPriceOmr: core.price,
    acquisition: core.acquisition,
    strategies: core.strategies,
    activeStrategy: core.active,
    financing: {
      mode: input.financing.mode,
      loanOmr: core.loanOmr,
      schedule: core.schedule,
      scheduledOutflows: core.scheduledOutflows,
    },
    metrics: core.metrics,
    projection: core.projection,
    residency,
    qualification,
    offer,
    scenarios,
    sensitivity,
    comparableSummary,
    dataQuality,
    explains: buildExplains(core),
    warnings,
  };
}

function qualificationInputs(
  core: CoreResult,
  input: InvestmentAnalysisInput,
  dataQualityScore: number,
) {
  return {
    grossYieldPct: core.metrics.grossYieldPct,
    netYieldPct: core.metrics.netYieldPct,
    cashOnCashPct: core.metrics.cashOnCashPct,
    irrPct: core.projection.irrPct,
    dscr: core.metrics.dscr,
    ltvPct: core.metrics.ltvPct,
    paybackYears: core.projection.paybackYears,
    monthlyCashFlowOmr: core.metrics.monthlyCashFlowOmr,
    annualIncomeOmr: core.active.effectiveGrossIncomeOmr,
    totalCashRequiredOmr:
      input.financing.mode === "payment_plan"
        ? core.projection.totalCashInOmr
        : core.acquisition.totalCashRequiredOmr,
    valueCagrPct: core.projection.valueCagrPct,
    residencyTier: residencyTier({ priceOmr: core.price }).tier,
    completionStatus: input.property.completionStatus,
    breakEvenOccupancyPct: core.metrics.breakEvenOccupancyPct,
    dataQualityScore,
  };
}

/** Minimal auto-derived provenance when the UI supplies none: property facts
 * as entered (assumed), price as entered, income/expense assumptions assumed. */
function autoTrackedFields(input: InvestmentAnalysisInput): SourcedValue[] {
  const p = input.property;
  const src = p.dataSource;
  const mk = (
    key: string,
    label: string,
    value: number | string | null,
    verified: boolean,
  ): SourcedValue => ({
    key,
    label,
    value,
    provenance: value == null || value === 0 ? "missing" : verified ? "verified" : "assumed",
    source: src,
    verifiedAt: p.verifiedAt,
  });
  const fromInventory = Boolean(src && src.length > 0);
  return [
    mk("askingPriceOmr", "Asking price", p.askingPriceOmr, fromInventory),
    mk("areaSqm", "Built-up area", p.areaSqm, fromInventory),
    mk("project", "Project", p.project ?? null, fromInventory),
    mk("developer", "Developer", p.developer ?? null, fromInventory),
    {
      key: "rentAssumptions",
      label: "Rental assumptions",
      value:
        input.strategies.daily || input.strategies.monthly || input.strategies.annual
          ? "entered"
          : null,
      provenance:
        input.strategies.daily || input.strategies.monthly || input.strategies.annual
          ? "assumed"
          : "missing",
    },
    {
      key: "operatingCosts",
      label: "Operating cost assumptions",
      value: "entered",
      provenance: "assumed",
    },
  ];
}
