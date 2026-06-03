import type { LadderTier, SourceFloor } from "@/domain";

// Default config used for demo rendering (mirrors the seed / DB config tables).
export const DEFAULT_LADDER: LadderTier[] = [
  { tierName: "Recovery", minPctOfTarget: 0.0, maxPctOfTarget: 0.5, agentSplitRate: 0.25, sortOrder: 0 },
  { tierName: "On Track", minPctOfTarget: 0.5, maxPctOfTarget: 0.8, agentSplitRate: 0.35, sortOrder: 1 },
  { tierName: "Strong", minPctOfTarget: 0.8, maxPctOfTarget: 1.0, agentSplitRate: 0.4, sortOrder: 2 },
  { tierName: "Top", minPctOfTarget: 1.0, maxPctOfTarget: null, agentSplitRate: 0.5, sortOrder: 3 },
];

export const DEFAULT_FLOORS: SourceFloor[] = [
  { source: "AGENT_NETWORK", floorSplitRate: 0.5 },
  { source: "ALWALAA_SOURCED", floorSplitRate: 0 },
];

export const TIER_COLORS: Record<string, string> = {
  Recovery: "text-tier-recovery",
  "On Track": "text-tier-strong",
  Strong: "text-tier-top",
  Top: "text-tier-elite",
};
