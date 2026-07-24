import type { LadderTier, LeadSource, SnapshotStatus, SourceFloor } from "../types";
import { ratioOf, sumOMR } from "../money";
import { resolveLadderTier } from "./ladder";
import { resolveEffectiveSplitRate } from "./sourceFloor";
import { computeAttributionPayout } from "./payout";

/** One closed-won attribution line for an agent in the period (by closeDate). */
export interface MonthlyDealLine {
  dealId: string;
  attributionId: string;
  dealValue: number;
  sharePct: number; // this agent's attribution share (fraction)
  developerRate: number; // resolved developer rate (fraction)
  leadSource: LeadSource;
  attributionReason: string;
}

export interface MonthlyPerformanceInput {
  agentId: string;
  period: string; // 'YYYY-MM'
  targetAmount: number;
  deals: MonthlyDealLine[]; // closed-won in this period
  ladder: LadderTier[];
  floors: SourceFloor[];
  status?: SnapshotStatus; // default PROVISIONAL
}

export interface CommissionLine {
  dealId: string;
  attributionId: string;
  developerRate: number;
  alwalaaGross: number;
  agentSplitRate: number; // effective (post-floor)
  agentPayout: number;
  attributionReason: string;
}

export interface MonthlyPerformanceResult {
  agentId: string;
  period: string;
  volumeClosed: number;
  targetAmount: number;
  pctOfTarget: number;
  currentTier: string;
  currentSplitRate: number; // ladder rate, pre-floor (what the tier yields)
  projectedPayout: number;
  finalPayout: number | null;
  status: SnapshotStatus;
  dealCount: number;
  alwalaaGrossMonth: number;
  commissions: CommissionLine[];
}

/**
 * Core monthly computation. The whole-month tier (from total volume) sets the
 * ladder rate; each line's effective split is max(ladderRate, sourceFloor).
 * Payouts are PROVISIONAL during the month and LOCK to FINAL at month-close;
 * recompute on every newly closed deal.
 */
export function computeMonthlyPerformance(
  input: MonthlyPerformanceInput,
): MonthlyPerformanceResult {
  const volumeClosed = sumOMR(input.deals.map((dl) => computeAttributedValue(dl)));
  const pctOfTarget = input.targetAmount > 0 ? ratioOf(volumeClosed, input.targetAmount) : 0;
  const tier = resolveLadderTier(pctOfTarget, input.ladder);

  const commissions: CommissionLine[] = input.deals.map((line) => {
    const effectiveSplit = resolveEffectiveSplitRate(tier.agentSplitRate, line.leadSource, input.floors);
    const { alwalaaGross, agentPayout } = computeAttributionPayout({
      dealValue: line.dealValue,
      sharePct: line.sharePct,
      developerRate: line.developerRate,
      agentSplitRate: effectiveSplit,
    });
    return {
      dealId: line.dealId,
      attributionId: line.attributionId,
      developerRate: line.developerRate,
      alwalaaGross,
      agentSplitRate: effectiveSplit,
      agentPayout,
      attributionReason: line.attributionReason,
    };
  });

  const projectedPayout = sumOMR(commissions.map((c) => c.agentPayout));
  const alwalaaGrossMonth = sumOMR(commissions.map((c) => c.alwalaaGross));
  const status: SnapshotStatus = input.status ?? "PROVISIONAL";

  return {
    agentId: input.agentId,
    period: input.period,
    volumeClosed,
    targetAmount: input.targetAmount,
    pctOfTarget,
    currentTier: tier.tierName,
    currentSplitRate: tier.agentSplitRate,
    projectedPayout,
    finalPayout: status === "FINAL" ? projectedPayout : null,
    status,
    dealCount: input.deals.length,
    alwalaaGrossMonth,
    commissions,
  };
}

/** Lock a provisional snapshot to FINAL at month-close. */
export function finalizeMonthlyPerformance(
  result: MonthlyPerformanceResult,
): MonthlyPerformanceResult {
  return { ...result, status: "FINAL", finalPayout: result.projectedPayout };
}

function computeAttributedValue(line: MonthlyDealLine): number {
  // Rounded to OMR via applyRate inside computeAttributionPayout; mirror here.
  return computeAttributionPayout({
    dealValue: line.dealValue,
    sharePct: line.sharePct,
    developerRate: 1,
    agentSplitRate: 1,
  }).attributedValue;
}
