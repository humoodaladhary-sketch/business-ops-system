// Accountability engine. Ramp-window agents and trainees are EXEMPT.
//   - 0 closings in the latest calendar month        -> Watch
//   - 2 consecutive months below 50% of target (or 0) -> At Risk
//     (At Risk should auto-create a CEO/admin review task — see application layer.)

export interface AtRiskMonth {
  period: string; // 'YYYY-MM'
  pctOfTarget: number; // fraction
  dealCount: number;
}

export interface AtRiskInput {
  exempt: boolean; // trainee / probation exemption
  inRampWindow: boolean; // now < rampEndDate
  months: AtRiskMonth[]; // chronological; most recent LAST
}

export interface AtRiskResult {
  watch: boolean;
  atRisk: boolean;
  reason: string | null;
}

const BELOW_THRESHOLD = 0.5;

export function evaluateAtRisk(input: AtRiskInput): AtRiskResult {
  if (input.exempt || input.inRampWindow) {
    return { watch: false, atRisk: false, reason: null };
  }

  const months = input.months;
  const latest = months[months.length - 1];
  const watch = !!latest && latest.dealCount === 0;

  let atRisk = false;
  if (months.length >= 2) {
    const prev = months[months.length - 2];
    const curr = months[months.length - 1];
    const below = (m: AtRiskMonth) => m.pctOfTarget < BELOW_THRESHOLD; // 0% counts as below
    atRisk = below(prev) && below(curr);
  }

  const reason = atRisk
    ? "Two consecutive months below 50% of target"
    : watch
      ? "No closings in the current month"
      : null;

  return { watch, atRisk, reason };
}
