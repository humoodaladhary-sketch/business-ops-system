// Investment-objective qualification engine. Pure and deterministic.
//
// The investor states measurable targets; the engine classifies the deal as
// meets / partially meets / does not meet / insufficient data, and for EVERY
// criterion reports pass/fail/unknown with the distance from target — never
// just a score. The 0–100 score is explainable: category subscores with
// configurable weights, each traceable to named metrics. A criterion whose
// metric is null (undefined ratio, missing input) is UNKNOWN — it never
// silently passes or fails.
import { roundPct } from "./acquisition";

/** The measurable targets an investor can set. All optional — unset = not a criterion. */
export interface ObjectiveProfile {
  minGrossYieldPct?: number;
  minNetYieldPct?: number;
  minCashOnCashPct?: number;
  minIrrPct?: number;
  minDscr?: number;
  maxLtvPct?: number;
  maxPaybackYears?: number;
  /** Minimum monthly pre-tax cash flow, OMR. */
  minMonthlyCashFlowOmr?: number;
  /** Minimum effective annual income (EGI), OMR. */
  minAnnualIncomeOmr?: number;
  /** Maximum cash the investor can put in, OMR. */
  maxInitialCashOmr?: number;
  /** Target holding period, years (informational — drives the projection, not a pass/fail). */
  targetHoldYears?: number;
  /** Minimum capital-value CAGR over the hold, whole percent. */
  minAppreciationCagrPct?: number;
  /** Required residency tier, when residency is the goal. */
  requiredResidencyTier?: "investor_2yr" | "golden_10yr";
  /** Required completion status. */
  requiredCompletion?: "ready" | "off_plan" | "any";
  /** Risk tolerance shifts the confidence commentary, not the arithmetic. */
  riskTolerance?: "low" | "medium" | "high";
}

/** Everything the evaluator needs, produced by the deterministic engine. */
export interface QualificationInputs {
  grossYieldPct: number | null;
  netYieldPct: number | null;
  cashOnCashPct: number | null;
  irrPct: number | null;
  dscr: number | null;
  ltvPct: number | null;
  paybackYears: number | null;
  monthlyCashFlowOmr: number | null;
  annualIncomeOmr: number | null;
  totalCashRequiredOmr: number | null;
  valueCagrPct: number | null;
  residencyTier: "none" | "investor_2yr" | "golden_10yr";
  completionStatus: "ready" | "off_plan" | "unknown";
  breakEvenOccupancyPct: number | null;
  /** 0–100 from provenance tracking. */
  dataQualityScore: number;
}

export type CriterionStatus = "pass" | "fail" | "unknown";

export interface CriterionResult {
  key: string;
  label: string;
  /** "min" targets require actual ≥ target; "max" require actual ≤ target. */
  direction: "min" | "max" | "equals";
  target: number | string;
  actual: number | string | null;
  status: CriterionStatus;
  /** Signed distance from target in the metric's own unit (positive = beyond target). */
  distance: number | null;
  /** Distance as a whole percent of the target where meaningful. */
  distancePct: number | null;
}

export type QualificationStatus =
  | "meets"
  | "partially_meets"
  | "does_not_meet"
  | "insufficient_data";

export interface ScoreCategory {
  key: string;
  label: string;
  /** 0–100 subscore. Null when no underlying metric was computable. */
  score: number | null;
  /** Configured weight (whole percent of the total). */
  weightPct: number;
  /** The metrics this category was scored from. */
  basis: string[];
}

export interface QualificationResult {
  status: QualificationStatus;
  criteria: CriterionResult[];
  passed: string[];
  failed: string[];
  unknown: string[];
  /** Explainable weighted score 0–100; null when nothing was computable. */
  score: number | null;
  categories: ScoreCategory[];
  confidence: "high" | "medium" | "low";
  positives: string[];
  negatives: string[];
  missingData: string[];
  recommendedAction: string;
}

/** Default category weights (whole percents, sum 100). Overridable per call. */
export const DEFAULT_SCORE_WEIGHTS: Record<string, number> = {
  incomeReturn: 20,
  cashFlow: 20,
  financing: 15,
  capitalGrowth: 15,
  breakEvenRisk: 15,
  dataQuality: 15,
};

/** Linear 0–100 scale between a floor (=0) and a ceiling (=100), clamped. */
function scale(value: number, floor: number, ceiling: number): number {
  if (ceiling === floor) return value >= ceiling ? 100 : 0;
  return Math.max(0, Math.min(100, ((value - floor) / (ceiling - floor)) * 100));
}

function criterion(
  key: string,
  label: string,
  direction: "min" | "max",
  target: number,
  actual: number | null,
): CriterionResult {
  if (actual == null) {
    return { key, label, direction, target, actual: null, status: "unknown", distance: null, distancePct: null };
  }
  const pass = direction === "min" ? actual >= target : actual <= target;
  const distance = direction === "min" ? actual - target : target - actual;
  return {
    key,
    label,
    direction,
    target,
    actual,
    status: pass ? "pass" : "fail",
    distance: Math.round(distance * 100) / 100,
    distancePct: target !== 0 ? roundPct((distance / Math.abs(target)) * 100) : null,
  };
}

const TIER_RANK = { none: 0, investor_2yr: 1, golden_10yr: 2 } as const;

/**
 * Evaluates the profile against the computed metrics.
 *
 * Classification:
 * - no criteria set, or every set criterion unknown → insufficient_data
 * - all evaluable criteria pass and none unknown → meets
 * - all evaluable pass but some unknown → partially_meets (honesty: unproven ≠ proven)
 * - some pass, some fail → partially_meets
 * - all evaluable fail → does_not_meet
 */
export function qualify(
  inputs: QualificationInputs,
  profile: ObjectiveProfile,
  weights: Record<string, number> = DEFAULT_SCORE_WEIGHTS,
): QualificationResult {
  const criteria: CriterionResult[] = [];
  const p = profile;

  if (p.minGrossYieldPct != null)
    criteria.push(criterion("grossYield", "Gross yield", "min", p.minGrossYieldPct, inputs.grossYieldPct));
  if (p.minNetYieldPct != null)
    criteria.push(criterion("netYield", "Net yield", "min", p.minNetYieldPct, inputs.netYieldPct));
  if (p.minCashOnCashPct != null)
    criteria.push(criterion("cashOnCash", "Cash-on-cash return", "min", p.minCashOnCashPct, inputs.cashOnCashPct));
  if (p.minIrrPct != null) criteria.push(criterion("irr", "IRR", "min", p.minIrrPct, inputs.irrPct));
  if (p.minDscr != null) criteria.push(criterion("dscr", "DSCR", "min", p.minDscr, inputs.dscr));
  if (p.maxLtvPct != null) criteria.push(criterion("ltv", "Loan-to-value", "max", p.maxLtvPct, inputs.ltvPct));
  if (p.maxPaybackYears != null)
    criteria.push(criterion("payback", "Payback period (years)", "max", p.maxPaybackYears, inputs.paybackYears));
  if (p.minMonthlyCashFlowOmr != null)
    criteria.push(
      criterion("monthlyCashFlow", "Monthly cash flow (OMR)", "min", p.minMonthlyCashFlowOmr, inputs.monthlyCashFlowOmr),
    );
  if (p.minAnnualIncomeOmr != null)
    criteria.push(
      criterion("annualIncome", "Effective annual income (OMR)", "min", p.minAnnualIncomeOmr, inputs.annualIncomeOmr),
    );
  if (p.maxInitialCashOmr != null)
    criteria.push(
      criterion("initialCash", "Initial cash required (OMR)", "max", p.maxInitialCashOmr, inputs.totalCashRequiredOmr),
    );
  if (p.minAppreciationCagrPct != null)
    criteria.push(
      criterion("appreciation", "Value CAGR over hold", "min", p.minAppreciationCagrPct, inputs.valueCagrPct),
    );
  if (p.requiredResidencyTier != null) {
    const required = p.requiredResidencyTier;
    const ok = TIER_RANK[inputs.residencyTier] >= TIER_RANK[required];
    criteria.push({
      key: "residency",
      label: "Residency tier",
      direction: "equals",
      target: required,
      actual: inputs.residencyTier,
      status: ok ? "pass" : "fail",
      distance: null,
      distancePct: null,
    });
  }
  if (p.requiredCompletion != null && p.requiredCompletion !== "any") {
    const actual = inputs.completionStatus;
    criteria.push({
      key: "completion",
      label: "Completion status",
      direction: "equals",
      target: p.requiredCompletion,
      actual,
      status: actual === "unknown" ? "unknown" : actual === p.requiredCompletion ? "pass" : "fail",
      distance: null,
      distancePct: null,
    });
  }

  const passed = criteria.filter((c) => c.status === "pass").map((c) => c.key);
  const failed = criteria.filter((c) => c.status === "fail").map((c) => c.key);
  const unknown = criteria.filter((c) => c.status === "unknown").map((c) => c.key);

  let status: QualificationStatus;
  if (criteria.length === 0 || passed.length + failed.length === 0) {
    status = "insufficient_data";
  } else if (failed.length === 0 && unknown.length === 0) {
    status = "meets";
  } else if (failed.length === 0) {
    status = "partially_meets"; // everything evaluable passed, but gaps remain
  } else if (passed.length === 0) {
    status = "does_not_meet";
  } else {
    status = "partially_meets";
  }

  // --- Explainable score: category subscores × configurable weights.
  const categories: ScoreCategory[] = [
    {
      key: "incomeReturn",
      label: "Income return",
      // 0 at 0% net yield, 100 at 8%+ (strong for Muscat residential).
      score: inputs.netYieldPct != null ? scale(inputs.netYieldPct, 0, 8) : null,
      weightPct: weights.incomeReturn ?? 0,
      basis: ["netYieldPct"],
    },
    {
      key: "cashFlow",
      label: "Cash flow",
      // 0 at −200 OMR/mo, 100 at +500 OMR/mo.
      score: inputs.monthlyCashFlowOmr != null ? scale(inputs.monthlyCashFlowOmr, -200, 500) : null,
      weightPct: weights.cashFlow ?? 0,
      basis: ["monthlyCashFlowOmr"],
    },
    {
      key: "financing",
      label: "Financing strength",
      // Unlevered deals score 100 (no debt risk). DSCR 1.0 → 0, 1.5+ → 100.
      score: inputs.dscr == null ? 100 : scale(inputs.dscr, 1.0, 1.5),
      weightPct: weights.financing ?? 0,
      basis: ["dscr"],
    },
    {
      key: "capitalGrowth",
      label: "Capital-growth potential",
      // 0 at 0% CAGR, 100 at 7%+. Null when no projection.
      score: inputs.valueCagrPct != null ? scale(inputs.valueCagrPct, 0, 7) : null,
      weightPct: weights.capitalGrowth ?? 0,
      basis: ["valueCagrPct"],
    },
    {
      key: "breakEvenRisk",
      label: "Break-even risk",
      // Break-even occupancy 95%+ → 0, 50% or lower → 100.
      score:
        inputs.breakEvenOccupancyPct != null ? scale(95 - inputs.breakEvenOccupancyPct, 0, 45) : null,
      weightPct: weights.breakEvenRisk ?? 0,
      basis: ["breakEvenOccupancyPct"],
    },
    {
      key: "dataQuality",
      label: "Data quality",
      score: inputs.dataQualityScore,
      weightPct: weights.dataQuality ?? 0,
      basis: ["dataQualityScore"],
    },
  ];

  const scorable = categories.filter((c) => c.score != null && c.weightPct > 0);
  const totalWeight = scorable.reduce((acc, c) => acc + c.weightPct, 0);
  const score =
    totalWeight > 0
      ? Math.round(scorable.reduce((acc, c) => acc + (c.score as number) * c.weightPct, 0) / totalWeight)
      : null;

  // --- Confidence from data quality + unknowns.
  const unknownShare = criteria.length > 0 ? unknown.length / criteria.length : 1;
  const confidence: QualificationResult["confidence"] =
    inputs.dataQualityScore >= 75 && unknownShare === 0
      ? "high"
      : inputs.dataQualityScore >= 45 && unknownShare <= 0.34
        ? "medium"
        : "low";

  // --- Narrative-ready factors (deterministic, no LLM).
  const positives: string[] = [];
  const negatives: string[] = [];
  for (const c of criteria) {
    if (c.status === "pass") positives.push(`${c.label} meets the target (${fmt(c.actual)} vs ${fmt(c.target)})`);
    if (c.status === "fail") negatives.push(`${c.label} misses the target (${fmt(c.actual)} vs ${fmt(c.target)})`);
  }
  if (inputs.breakEvenOccupancyPct != null && inputs.breakEvenOccupancyPct > 85) {
    negatives.push(`Break-even occupancy is high at ${inputs.breakEvenOccupancyPct}%`);
  }
  if (inputs.monthlyCashFlowOmr != null && inputs.monthlyCashFlowOmr < 0) {
    negatives.push(`Negative monthly cash flow (${inputs.monthlyCashFlowOmr} OMR/mo)`);
  }

  const missingData = unknown.map((k) => criteria.find((c) => c.key === k)?.label ?? k);

  const recommendedAction =
    status === "meets"
      ? "Proceed to the offer stage at or below the analysis price."
      : status === "partially_meets"
        ? failed.length > 0
          ? "Renegotiate: use the offer-price solver to find the price at which the failed criteria pass, or revisit the failing assumptions."
          : "Verify the missing inputs before committing — the evaluable criteria pass."
        : status === "does_not_meet"
          ? "Reject at this price, or test the walk-away price from the offer solver."
          : "Enter the investor's measurable objectives (or more deal data) to qualify this deal.";

  return {
    status,
    criteria,
    passed,
    failed,
    unknown,
    score,
    categories,
    confidence,
    positives,
    negatives,
    missingData,
    recommendedAction,
  };
}

function fmt(v: number | string | null): string {
  if (v == null) return "—";
  return typeof v === "number" ? `${v}` : v;
}
