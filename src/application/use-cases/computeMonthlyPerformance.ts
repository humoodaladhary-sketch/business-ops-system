import { computeMonthlyPerformance, type MonthlyPerformanceResult } from "@/domain";
import type { ConfigPort, PerformancePort } from "../ports";

export interface PerfDeps {
  config: ConfigPort;
  perf: PerformancePort;
}

/** Load an agent's month + config and run the pure engine. */
export async function computeMonthlyPerformanceForAgent(
  agentId: string,
  period: string,
  deps: PerfDeps,
): Promise<MonthlyPerformanceResult> {
  const [ladder, floors, targetAmount, deals] = await Promise.all([
    deps.config.getLadder(),
    deps.config.getFloors(),
    deps.perf.getTarget(agentId, period),
    deps.perf.getClosedDealLines(agentId, period),
  ]);

  return computeMonthlyPerformance({ agentId, period, targetAmount, deals, ladder, floors });
}
