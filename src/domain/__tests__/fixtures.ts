import type { LadderTier, SourceFloor } from "../types";

// The 25 / 35 / 40 / 50 ladder from the brief, as fractions.
export const LADDER: LadderTier[] = [
  { tierName: "Recovery", minPctOfTarget: 0.0, maxPctOfTarget: 0.5, agentSplitRate: 0.25, sortOrder: 0 },
  { tierName: "On Track", minPctOfTarget: 0.5, maxPctOfTarget: 0.8, agentSplitRate: 0.35, sortOrder: 1 },
  { tierName: "Strong", minPctOfTarget: 0.8, maxPctOfTarget: 1.0, agentSplitRate: 0.4, sortOrder: 2 },
  { tierName: "Top", minPctOfTarget: 1.0, maxPctOfTarget: null, agentSplitRate: 0.5, sortOrder: 3 },
];

// Decision 1: own/referral leads floor at 50%; Alwalaa-sourced ladder-only.
export const FLOORS: SourceFloor[] = [
  { source: "AGENT_NETWORK", floorSplitRate: 0.5 },
  { source: "ALWALAA_SOURCED", floorSplitRate: 0 },
];
