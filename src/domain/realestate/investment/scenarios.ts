// Scenario presets and one-way sensitivity analysis. Pure and deterministic.
//
// A scenario is a set of whole-percent DELTAS applied to the base assumptions
// (price, rent, occupancy, expenses, rate, appreciation, exit, hold). The
// orchestrator owns applying deltas to its input shape; this module owns the
// preset definitions, the sensitivity sweep and the ranked-impact (tornado)
// view, all driven through an `evaluate` closure so the engine stays acyclic.

export interface ScenarioAdjustments {
  /** All whole-percent deltas relative to base (−10 = 10% worse/lower). */
  priceDeltaPct?: number;
  rentDeltaPct?: number;
  /** Delta in occupancy PERCENTAGE POINTS (−10 = ten points lower occupancy). */
  occupancyDeltaPts?: number;
  expensesDeltaPct?: number;
  /** Delta in annual interest rate, percentage points. */
  interestDeltaPts?: number;
  /** Delta in annual appreciation, percentage points. */
  appreciationDeltaPts?: number;
  /** Delta in exit value, whole percent (applied to appreciated/cap exit value). */
  exitValueDeltaPct?: number;
  /** Delta in holding period, years. */
  holdDeltaYears?: number;
  /** Delta in handover timing, months (off-plan completion delay). */
  completionDelayMonths?: number;
}

export interface ScenarioDefinition {
  key: "conservative" | "base" | "optimistic" | "custom";
  label: string;
  adjustments: ScenarioAdjustments;
}

/**
 * Standard presets. Deliberately modest: the conservative case is a stress
 * test an investor will actually believe (−10% rent, −10pts occupancy, +15%
 * expenses, +1pt rate, appreciation halved via −2pts, +6-month delay).
 */
export const SCENARIO_PRESETS: ScenarioDefinition[] = [
  {
    key: "conservative",
    label: "Conservative",
    adjustments: {
      rentDeltaPct: -10,
      occupancyDeltaPts: -10,
      expensesDeltaPct: 15,
      interestDeltaPts: 1,
      appreciationDeltaPts: -2,
      completionDelayMonths: 6,
    },
  },
  { key: "base", label: "Base", adjustments: {} },
  {
    key: "optimistic",
    label: "Optimistic",
    adjustments: {
      rentDeltaPct: 8,
      occupancyDeltaPts: 5,
      expensesDeltaPct: -5,
      appreciationDeltaPts: 1,
    },
  },
];

/** The headline metrics a scenario/sensitivity run reports. */
export interface ScenarioOutcome {
  irrPct: number | null;
  cashOnCashPct: number | null;
  netYieldPct: number | null;
  monthlyCashFlowOmr: number | null;
  npvOmr: number | null;
  totalProfitOmr: number | null;
}

export interface ScenarioResult {
  definition: ScenarioDefinition;
  outcome: ScenarioOutcome;
}

/** Runs each scenario through the orchestrator-supplied evaluator. */
export function runScenarios(
  definitions: ScenarioDefinition[],
  evaluate: (adjustments: ScenarioAdjustments) => ScenarioOutcome,
): ScenarioResult[] {
  return definitions.map((definition) => ({ definition, outcome: evaluate(definition.adjustments) }));
}

// ---------------------------------------------------------------------------
// Sensitivity
// ---------------------------------------------------------------------------

/** One variable swept over a symmetric range of steps. */
export interface SensitivityVariable {
  key: keyof ScenarioAdjustments;
  label: string;
  /** The delta applied at each step, e.g. [−20, −10, 0, 10, 20]. */
  steps: number[];
  /** Unit label for display ("%", "pts", "months", "years"). */
  unit: string;
}

/** Default one-way sweep set covering the assumptions that move deals most. */
export const DEFAULT_SENSITIVITY_VARIABLES: SensitivityVariable[] = [
  { key: "priceDeltaPct", label: "Purchase price", steps: [-10, -5, 0, 5, 10], unit: "%" },
  { key: "rentDeltaPct", label: "Rental rate", steps: [-20, -10, 0, 10, 20], unit: "%" },
  { key: "occupancyDeltaPts", label: "Occupancy", steps: [-20, -10, 0, 5, 10], unit: "pts" },
  { key: "expensesDeltaPct", label: "Operating expenses", steps: [-10, 0, 10, 25, 50], unit: "%" },
  { key: "interestDeltaPts", label: "Interest rate", steps: [-1, 0, 1, 2, 3], unit: "pts" },
  { key: "appreciationDeltaPts", label: "Appreciation", steps: [-3, -1, 0, 1, 2], unit: "pts" },
  { key: "exitValueDeltaPct", label: "Exit price", steps: [-20, -10, 0, 10, 20], unit: "%" },
  { key: "holdDeltaYears", label: "Holding period", steps: [-2, 0, 2, 5], unit: "years" },
  { key: "completionDelayMonths", label: "Completion delay", steps: [0, 6, 12, 24], unit: "months" },
];

export interface SensitivityCell {
  step: number;
  outcome: ScenarioOutcome;
}

export interface SensitivityRow {
  variable: SensitivityVariable;
  cells: SensitivityCell[];
  /** |best − worst| of the focus metric across the sweep (impact ranking). */
  impact: number | null;
}

export interface SensitivityResult {
  /** Which outcome field the impact ranking uses. */
  focusMetric: keyof ScenarioOutcome;
  rows: SensitivityRow[];
  /** Rows sorted by impact, largest first (the tornado order). Nulls last. */
  ranked: SensitivityRow[];
}

/**
 * One-way sensitivity: each variable swept independently, others at base.
 * Impact = spread of the focus metric across the sweep; the ranked list is
 * the tornado view.
 */
export function runSensitivity(
  variables: SensitivityVariable[],
  evaluate: (adjustments: ScenarioAdjustments) => ScenarioOutcome,
  focusMetric: keyof ScenarioOutcome = "irrPct",
): SensitivityResult {
  const rows: SensitivityRow[] = variables.map((variable) => {
    const cells = variable.steps.map((step) => ({
      step,
      outcome: evaluate({ [variable.key]: step } as ScenarioAdjustments),
    }));
    const values = cells.map((c) => c.outcome[focusMetric]).filter((v): v is number => v != null);
    const impact =
      values.length >= 2 ? Math.round((Math.max(...values) - Math.min(...values)) * 100) / 100 : null;
    return { variable, cells, impact };
  });

  const ranked = [...rows].sort((a, b) => {
    if (a.impact == null && b.impact == null) return 0;
    if (a.impact == null) return 1;
    if (b.impact == null) return -1;
    return b.impact - a.impact;
  });

  return { focusMetric, rows, ranked };
}
