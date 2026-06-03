import type { LeadSource, SourceFloor } from "../types";

/** The floor split rate for a lead source (0 = no floor). */
export function resolveSourceFloor(source: LeadSource, floors: SourceFloor[]): number {
  return floors.find((f) => f.source === source)?.floorSplitRate ?? 0;
}

/**
 * Hybrid split (Decision 1): the agent's effective split is the higher of the
 * performance-ladder rate and the lead-source floor. So own/referral leads
 * never pay below their floor, while Alwalaa-sourced leads are ladder-only.
 */
export function resolveEffectiveSplitRate(
  ladderRate: number,
  source: LeadSource,
  floors: SourceFloor[],
): number {
  return Math.max(ladderRate, resolveSourceFloor(source, floors));
}
