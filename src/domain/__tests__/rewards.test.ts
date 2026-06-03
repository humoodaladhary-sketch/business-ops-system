import { describe, it, expect } from "vitest";
import {
  computeAgentOfMonth,
  computeOverachievers,
  computeStreakBonuses,
  computeRewards,
  type AgentMonth,
  type RewardConfig,
} from "../rewards";

const CONFIG: RewardConfig = {
  overachieverBonus: 1000,
  streakBonus: 2000,
  topTierNames: ["Top"],
  streakLength: 3,
};

describe("computeAgentOfMonth", () => {
  it("picks the highest % of target", () => {
    const agents: AgentMonth[] = [
      { agentId: "a", pctOfTarget: 0.9 },
      { agentId: "b", pctOfTarget: 1.4 },
      { agentId: "c", pctOfTarget: 1.1 },
    ];
    expect(computeAgentOfMonth(agents)?.agentId).toBe("b");
  });

  it("returns null when nobody sold", () => {
    expect(computeAgentOfMonth([{ agentId: "a", pctOfTarget: 0 }])).toBeNull();
  });
});

describe("computeOverachievers", () => {
  it("rewards agents at >= 200% of target", () => {
    const out = computeOverachievers(
      [
        { agentId: "a", pctOfTarget: 2.0 },
        { agentId: "b", pctOfTarget: 1.99 },
        { agentId: "c", pctOfTarget: 3.2 },
      ],
      1000,
    );
    expect(out.map((r) => r.agentId)).toEqual(["a", "c"]);
    expect(out[0].amount).toBe(1000);
  });
});

describe("computeStreakBonuses", () => {
  it("rewards 3 consecutive months at the top tier", () => {
    const out = computeStreakBonuses(
      [{ agentId: "a", pctOfTarget: 1.2, tierHistory: ["Top", "Top", "Top"] }],
      CONFIG,
    );
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(2000);
  });

  it("does not reward a broken streak", () => {
    const out = computeStreakBonuses(
      [{ agentId: "a", pctOfTarget: 1.2, tierHistory: ["Top", "Strong", "Top"] }],
      CONFIG,
    );
    expect(out).toHaveLength(0);
  });

  it("requires at least streakLength months of history", () => {
    const out = computeStreakBonuses(
      [{ agentId: "a", pctOfTarget: 1.2, tierHistory: ["Top", "Top"] }],
      CONFIG,
    );
    expect(out).toHaveLength(0);
  });
});

describe("computeRewards (integration)", () => {
  it("combines agent-of-month, overachiever and streak rewards", () => {
    const agents: AgentMonth[] = [
      { agentId: "a", pctOfTarget: 2.3, tierHistory: ["Top", "Top", "Top"] },
      { agentId: "b", pctOfTarget: 0.8, tierHistory: ["On Track", "Strong", "Strong"] },
    ];
    const rewards = computeRewards(agents, CONFIG);
    const types = rewards.filter((r) => r.agentId === "a").map((r) => r.type);
    expect(types).toContain("AGENT_OF_MONTH");
    expect(types).toContain("OVERACHIEVER_BONUS");
    expect(types).toContain("STREAK_BONUS");
  });
});
