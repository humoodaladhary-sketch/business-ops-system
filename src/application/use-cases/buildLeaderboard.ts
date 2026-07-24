import type { ConfigPort, PerformancePort } from "../ports";
import { computeMonthlyPerformanceForAgent } from "./computeMonthlyPerformance";
import { evaluateAtRiskForAgent } from "./evaluateAtRisk";

export interface LeaderboardRow {
  agentId: string;
  name: string;
  role: string;
  volume: number;
  target: number;
  pct: number;
  tier: string;
  projectedPayout: number;
  dealCount: number;
  atRisk: boolean;
  watch: boolean;
}

/** Compute every agent's month and rank by % of target (desc). */
export async function buildLeaderboard(
  period: string,
  deps: { config: ConfigPort; perf: PerformancePort },
): Promise<LeaderboardRow[]> {
  const agents = await deps.perf.listAgents();

  const rows = await Promise.all(
    agents.map(async (a) => {
      const result = await computeMonthlyPerformanceForAgent(a.id, period, deps);
      const risk = await evaluateAtRiskForAgent(a.id, period, deps);
      return {
        agentId: a.id,
        name: a.name,
        role: a.role,
        volume: result.volumeClosed,
        target: result.targetAmount,
        pct: result.pctOfTarget,
        tier: result.currentTier,
        projectedPayout: result.projectedPayout,
        dealCount: result.dealCount,
        atRisk: risk.atRisk,
        watch: risk.watch,
      };
    }),
  );

  return rows.sort((a, b) => b.pct - a.pct);
}
