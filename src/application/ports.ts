// Repository ports. The application orchestrates the pure domain engine through
// these interfaces; infrastructure provides the Prisma-backed implementations.
import type {
  LadderTier,
  SourceFloor,
  MonthlyDealLine,
  MonthlyPerformanceResult,
} from "@/domain";

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  segment: string;
  exemptFromAtRisk: boolean;
  inRampWindow: boolean;
}

export interface MonthHistory {
  period: string;
  pctOfTarget: number;
  dealCount: number;
}

export interface RewardSettings {
  overachieverBonus: number;
  streakBonus: number;
  topTierNames: string[];
}

export interface ConfigPort {
  getLadder(): Promise<LadderTier[]>;
  getFloors(): Promise<SourceFloor[]>;
  getRewardSettings(): Promise<RewardSettings>;
}

export interface PerformancePort {
  listAgents(): Promise<AgentSummary[]>;
  getTarget(agentId: string, period: string): Promise<number>;
  getClosedDealLines(agentId: string, period: string): Promise<MonthlyDealLine[]>;
  getMonthHistory(agentId: string, periods: string[]): Promise<MonthHistory[]>;
}

export interface SnapshotWriterPort {
  saveSnapshot(result: MonthlyPerformanceResult): Promise<void>;
}
