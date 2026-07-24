import type { RewardType } from "./types";

// Auto-computed each month-close:
//   - Agent of the Month = highest % of target that period
//   - Overachiever bonus at >= 200% of target (cash kicker; split stays <= 50%)
//   - Streak bonus for 3 consecutive months at the top tier

export interface AgentMonth {
  agentId: string;
  pctOfTarget: number; // fraction
  tierHistory?: string[]; // chronological tier names; most recent LAST
}

export interface RewardLine {
  agentId: string;
  type: RewardType;
  amount: number;
  note: string;
}

export interface RewardConfig {
  overachieverBonus: number; // flat OMR kicker at >= 200%
  streakBonus: number; // flat OMR for 3 months at top tier
  topTierNames: string[]; // tier names that count as "top" (e.g. ["Top"])
  streakLength?: number; // default 3
}

export function computeAgentOfMonth(agents: AgentMonth[]): RewardLine | null {
  const eligible = agents.filter((a) => a.pctOfTarget > 0);
  if (eligible.length === 0) return null;
  const top = eligible.reduce((best, a) => (a.pctOfTarget > best.pctOfTarget ? a : best));
  return {
    agentId: top.agentId,
    type: "AGENT_OF_MONTH",
    amount: 0,
    note: `Highest % of target (${Math.round(top.pctOfTarget * 100)}%)`,
  };
}

export function computeOverachievers(agents: AgentMonth[], bonus: number): RewardLine[] {
  return agents
    .filter((a) => a.pctOfTarget >= 2.0)
    .map((a) => ({
      agentId: a.agentId,
      type: "OVERACHIEVER_BONUS" as RewardType,
      amount: bonus,
      note: "Achieved >= 200% of target (split capped at 50%)",
    }));
}

export function computeStreakBonuses(agents: AgentMonth[], config: RewardConfig): RewardLine[] {
  const len = config.streakLength ?? 3;
  return agents
    .filter((a) => {
      const history = a.tierHistory ?? [];
      if (history.length < len) return false;
      return history.slice(-len).every((t) => config.topTierNames.includes(t));
    })
    .map((a) => ({
      agentId: a.agentId,
      type: "STREAK_BONUS" as RewardType,
      amount: config.streakBonus,
      note: `${len} consecutive months at top tier`,
    }));
}

/** All rewards for a period in one call. */
export function computeRewards(agents: AgentMonth[], config: RewardConfig): RewardLine[] {
  const out: RewardLine[] = [];
  const aotm = computeAgentOfMonth(agents);
  if (aotm) out.push(aotm);
  out.push(...computeOverachievers(agents, config.overachieverBonus));
  out.push(...computeStreakBonuses(agents, config));
  return out;
}
