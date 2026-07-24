import type { LadderTier } from "./types";
import { applyRate, ratioOf, roundOMR } from "./money";
import { nextLadderTier, resolveLadderTier } from "./commission/ladder";

// Milestone snapshots at 10/30/50/70/90/100% of target.
export const MILESTONES = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0];

export function milestonesReached(pctOfTarget: number): number[] {
  return MILESTONES.filter((m) => pctOfTarget >= m);
}

export function nextMilestone(pctOfTarget: number): number | null {
  return MILESTONES.find((m) => m > pctOfTarget) ?? null;
}

export interface NextTierNudge {
  hasNext: boolean;
  currentTierName: string;
  currentSplitRate: number;
  nextTierName?: string;
  nextSplitRate?: number;
  amountToNextTier?: number; // OMR more volume needed to reach the next rung
  extraPayoutEstimate?: number; // ~OMR more this month if the next rung is reached
}

/**
 * Powers the signature live tier-progress widget, e.g.
 *   "You're at 72% of target. Close 28K more to move 35% -> 40% and earn
 *    ~1,400 OMR more this month."
 * Moving up a rung raises the split on the whole month's gross, so the extra
 * payout estimate uses the month's Alwalaa gross so far.
 */
export function computeNextTierNudge(args: {
  volumeClosed: number;
  targetAmount: number;
  ladder: LadderTier[];
  alwalaaGrossMonth: number;
}): NextTierNudge {
  const { volumeClosed, targetAmount, ladder, alwalaaGrossMonth } = args;
  const pct = targetAmount > 0 ? ratioOf(volumeClosed, targetAmount) : 0;
  const current = resolveLadderTier(pct, ladder);
  const next = nextLadderTier(pct, ladder);

  if (!next) {
    return { hasNext: false, currentTierName: current.tierName, currentSplitRate: current.agentSplitRate };
  }

  const amountToNextTier = roundOMR(Math.max(0, next.minPctOfTarget * targetAmount - volumeClosed));
  const extraPayoutEstimate = applyRate(
    alwalaaGrossMonth,
    next.agentSplitRate - current.agentSplitRate,
  );

  return {
    hasNext: true,
    currentTierName: current.tierName,
    currentSplitRate: current.agentSplitRate,
    nextTierName: next.tierName,
    nextSplitRate: next.agentSplitRate,
    amountToNextTier,
    extraPayoutEstimate,
  };
}

export interface PaceResult {
  expectedPct: number; // where they "should" be given days elapsed
  actualPct: number;
  aheadOfPace: boolean;
  gapToPace: number; // OMR behind (positive) or ahead (negative) of pace
}

/** Thursday-pace check: actual vs linear pace through the month. */
export function computePace(args: {
  volumeClosed: number;
  targetAmount: number;
  dayOfMonth: number;
  daysInMonth: number;
}): PaceResult {
  const { volumeClosed, targetAmount, dayOfMonth, daysInMonth } = args;
  const fractionElapsed = daysInMonth > 0 ? dayOfMonth / daysInMonth : 0;
  const expectedVolume = targetAmount * fractionElapsed;
  const actualPct = targetAmount > 0 ? ratioOf(volumeClosed, targetAmount) : 0;
  return {
    expectedPct: fractionElapsed,
    actualPct,
    aheadOfPace: volumeClosed >= expectedVolume,
    gapToPace: roundOMR(expectedVolume - volumeClosed),
  };
}
