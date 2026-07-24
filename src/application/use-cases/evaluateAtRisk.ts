import { evaluateAtRisk, type AtRiskResult } from "@/domain";
import type { PerformancePort } from "../ports";

/** Look back two months and apply the at-risk rules (ramp/trainee exempt). */
export async function evaluateAtRiskForAgent(
  agentId: string,
  period: string,
  deps: { perf: PerformancePort },
): Promise<AtRiskResult> {
  const agents = await deps.perf.listAgents();
  const agent = agents.find((a) => a.id === agentId);
  const periods = previousPeriods(period, 2);
  const history = await deps.perf.getMonthHistory(agentId, periods);

  return evaluateAtRisk({
    exempt: agent?.exemptFromAtRisk ?? false,
    inRampWindow: agent?.inRampWindow ?? false,
    months: history.map((h) => ({ period: h.period, pctOfTarget: h.pctOfTarget, dealCount: h.dealCount })),
  });
}

/** ['2026-03'] for n=1 incl current -> here we return the last `count` periods up to & incl `period`. */
export function previousPeriods(period: string, count: number): string[] {
  const [y, m] = period.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
