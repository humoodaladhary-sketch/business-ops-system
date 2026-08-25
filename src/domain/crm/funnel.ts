// Sales-funnel summary + monthly trend series. Pure and deterministic —
// counts only what the rows actually say, and reports the bottleneck as the
// largest measured drop between adjacent stages.

/** The funnel's stage groups, in order. */
const FUNNEL_STEPS = [
  { key: "leads", label: "Leads", stages: ["NEW", "QUALIFIED", "ENGAGED"] },
  { key: "viewing", label: "Viewing", stages: ["VIEWING"] },
  { key: "negotiation", label: "Negotiation", stages: ["NEGOTIATION"] },
  { key: "reservation", label: "Reservation", stages: ["RESERVATION"] },
  { key: "closed", label: "Closed won", stages: ["CLOSED_WON"] },
] as const;

export interface FunnelStep {
  key: string;
  label: string;
  /** Rows currently at or beyond this step (cumulative funnel count). */
  count: number;
  /** Conversion vs the previous step, whole percent (null for the first). */
  conversionPct: number | null;
}

export interface FunnelSummary {
  steps: FunnelStep[];
  /** Step key where the largest drop happens; null when funnel is empty. */
  bottleneckKey: string | null;
  totalOpen: number;
}

/**
 * Builds a cumulative funnel from lead stages: each step counts rows at that
 * step OR any later step, so the shape is monotone and conversion honest.
 * CLOSED_LOST rows count only toward the steps they passed (unknown → they
 * are excluded entirely; we do not guess how far a lost lead progressed).
 */
export function summarizeFunnel(leads: { stage: string }[]): FunnelSummary {
  const stageIndex = new Map<string, number>();
  FUNNEL_STEPS.forEach((s, i) => s.stages.forEach((st) => stageIndex.set(st, i)));

  const reached = new Array<number>(FUNNEL_STEPS.length).fill(0);
  for (const lead of leads) {
    const idx = stageIndex.get(lead.stage.toUpperCase());
    if (idx == null) continue; // unknown or CLOSED_LOST — never guessed forward
    for (let i = 0; i <= idx; i++) reached[i] += 1;
  }

  const steps: FunnelStep[] = FUNNEL_STEPS.map((s, i) => ({
    key: s.key,
    label: s.label,
    count: reached[i],
    conversionPct:
      i === 0 || reached[i - 1] === 0
        ? i === 0
          ? null
          : null
        : Math.round((reached[i] / reached[i - 1]) * 100),
  }));

  let bottleneckKey: string | null = null;
  let worst = 101;
  for (const s of steps) {
    if (s.conversionPct != null && s.conversionPct < worst && steps[0].count > 0) {
      worst = s.conversionPct;
      bottleneckKey = s.key;
    }
  }

  return {
    steps,
    bottleneckKey,
    totalOpen: leads.filter((l) => !["CLOSED_WON", "CLOSED_LOST"].includes(l.stage.toUpperCase())).length,
  };
}

// ---------------------------------------------------------------------------
// Monthly series (sparklines)
// ---------------------------------------------------------------------------

export interface MonthPoint {
  period: string; // YYYY-MM
  value: number;
}

/**
 * Sums `value` per month over the trailing `months` periods ending at
 * `endPeriod` (inclusive), zero-filling empty months so sparklines keep a
 * stable x-axis. Rows without a period are ignored.
 */
export function monthlySeries(
  rows: { period: string | null | undefined; value: number }[],
  endPeriod: string,
  months = 6,
): MonthPoint[] {
  const [y, m] = endPeriod.split("-").map(Number);
  if (!y || !m) return [];
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const sums = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const r of rows) {
    if (!r.period) continue;
    const key = r.period.slice(0, 7);
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + r.value);
  }
  return keys.map((period) => ({ period, value: Math.round((sums.get(period) ?? 0) * 1000) / 1000 }));
}

/** Change of the last point vs the one before, whole percent (null when undefined). */
export function lastDeltaPct(series: MonthPoint[]): number | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2].value;
  const last = series[series.length - 1].value;
  if (prev === 0) return null;
  return Math.round(((last - prev) / Math.abs(prev)) * 100);
}
