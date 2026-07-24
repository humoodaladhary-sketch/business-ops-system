import type { LadderTier } from "../types";

export interface LadderResolution {
  tierName: string;
  agentSplitRate: number;
}

/**
 * Resolve the ladder tier from the whole-month % of target (a fraction).
 * Boundaries: min inclusive, max exclusive. The reached tier applies to the
 * entire month (retroactive), per the brief.
 */
export function resolveLadderTier(pctOfTarget: number, ladder: LadderTier[]): LadderResolution {
  if (ladder.length === 0) {
    throw new Error("CommissionLadder is empty — cannot resolve tier");
  }
  const sorted = [...ladder].sort((a, b) => a.sortOrder - b.sortOrder);

  let match = sorted.find(
    (t) =>
      pctOfTarget >= t.minPctOfTarget &&
      (t.maxPctOfTarget === null || pctOfTarget < t.maxPctOfTarget),
  );

  // Below the lowest min -> lowest tier; above the highest -> highest tier.
  if (!match) {
    match = pctOfTarget < sorted[0].minPctOfTarget ? sorted[0] : sorted[sorted.length - 1];
  }

  return { tierName: match.tierName, agentSplitRate: match.agentSplitRate };
}

/** The next rung above the current % of target, if any (for the nudge widget). */
export function nextLadderTier(pctOfTarget: number, ladder: LadderTier[]): LadderTier | null {
  const sorted = [...ladder].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((t) => t.minPctOfTarget > pctOfTarget) ?? null;
}
