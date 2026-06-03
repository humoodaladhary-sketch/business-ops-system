import { applyRate } from "../money";

export interface PayoutInput {
  dealValue: number; // OMR, excl. VAT (per SPA)
  sharePct: number; // this agent's attribution share (fraction)
  developerRate: number; // developer -> Alwalaa (fraction)
  agentSplitRate: number; // already floor-adjusted (fraction)
}

export interface PayoutResult {
  attributedValue: number; // dealValue * share
  alwalaaGross: number; // attributedValue * developerRate
  agentPayout: number; // alwalaaGross * agentSplitRate
}

/**
 * Per-attribution payout. Each money step is rounded to OMR baisa so totals
 * reconcile exactly:
 *   attributedValue = dealValue × share
 *   alwalaaGross    = attributedValue × developerRate
 *   agentPayout     = alwalaaGross × agentSplitRate
 */
export function computeAttributionPayout(input: PayoutInput): PayoutResult {
  const attributedValue = applyRate(input.dealValue, input.sharePct);
  const alwalaaGross = applyRate(attributedValue, input.developerRate);
  const agentPayout = applyRate(alwalaaGross, input.agentSplitRate);
  return { attributedValue, alwalaaGross, agentPayout };
}
