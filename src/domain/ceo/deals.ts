// Deals: what a sale actually leaves in the company.
//
// `companyNet` is computed from components, never read from the source sheet's
// own net column. The sheet's arithmetic disagrees with itself by a baisa on a
// handful of rows (it rounds the agent cut down where half-up rounds it up);
// the formula is the contract, so the formula wins and the divergence is
// asserted in the tests rather than absorbed silently.

import { type Baisa, applyPct, ratio, sumBaisa } from "./baisa";
import type { MonthKey } from "./calendar";
import { compareMonths, monthRange } from "./calendar";
import type { Deal, MonthWindow } from "./types";

/**
 * companyNet(deal) = grossCommission − referral − agentShare + incentive
 *
 * This is what Alwalaa keeps from a deal after paying the referrer and the
 * advisor, plus any developer incentive.
 */
export function companyNet(deal: Deal): Baisa {
  return deal.grossCommissionBaisa - deal.referralBaisa - deal.agentAmountBaisa + deal.incentiveBaisa;
}

/** The advisor's own take from a deal. */
export function agentShare(deal: Deal): Baisa {
  return deal.agentAmountBaisa;
}

/**
 * Recompute the agent cut from percentages — used to audit imported rows.
 *
 * The referral comes off the top FIRST, and the advisor takes their cut of what
 * is left. Both referral deals in the 2026 book confirm it exactly: HUM-0004 is
 * 50% of (3,938.400 − 1,969.200) = 984.600, and HUM-0005 is 50% of
 * (2,170.000 − 1,085.000) = 542.500. Computing the cut on gross would overstate
 * the advisor's share on every referred deal and flag both as errors.
 */
export function expectedAgentAmount(deal: Deal): Baisa {
  return applyPct(deal.grossCommissionBaisa - deal.referralBaisa, deal.agentCutPct);
}

/**
 * Deals whose recorded agent cut does not match their own stated percentage.
 * This is a data-quality report on the source sheet, not a correction:
 * `companyNet` always uses the recorded amounts, because those are what was
 * actually paid and what the published figures are built from.
 */
export function agentCutAnomalies(
  deals: readonly Deal[],
  opts: { toleranceBaisa?: number } = {},
): { deal: Deal; recordedBaisa: Baisa; expectedBaisa: Baisa; differenceBaisa: Baisa }[] {
  // One baisa of drift is the source sheet's own float rounding, not an anomaly.
  const tolerance = opts.toleranceBaisa ?? 1;
  return deals
    .map((deal) => {
      const expectedBaisa = expectedAgentAmount(deal);
      return {
        deal,
        recordedBaisa: deal.agentAmountBaisa,
        expectedBaisa,
        differenceBaisa: expectedBaisa - deal.agentAmountBaisa,
      };
    })
    .filter((r) => Math.abs(r.differenceBaisa) > tolerance);
}

/** Difference between the source sheet's net and the formula's net, in baisa. */
export function netReconciliationDelta(deal: Deal): Baisa {
  return companyNet(deal) - deal.recordedCompanyNetBaisa;
}

export function inWindow(deal: Deal, window: MonthWindow): boolean {
  return compareMonths(deal.month, window.from) >= 0 && compareMonths(deal.month, window.to) <= 0;
}

export function dealsInWindow(deals: readonly Deal[], window: MonthWindow): Deal[] {
  return deals.filter((d) => inWindow(d, window));
}

export function dealsForPerson(deals: readonly Deal[], personId: string): Deal[] {
  return deals.filter((d) => d.advisorId === personId);
}

export interface DealTotals {
  count: number;
  volumeBaisa: Baisa;
  grossCommissionBaisa: Baisa;
  referralBaisa: Baisa;
  agentShareBaisa: Baisa;
  incentiveBaisa: Baisa;
  /** What the company kept — "brought in" on the person card. */
  companyNetBaisa: Baisa;
}

export const ZERO_TOTALS: DealTotals = {
  count: 0,
  volumeBaisa: 0,
  grossCommissionBaisa: 0,
  referralBaisa: 0,
  agentShareBaisa: 0,
  incentiveBaisa: 0,
  companyNetBaisa: 0,
};

export function totalsOf(deals: readonly Deal[]): DealTotals {
  return {
    count: deals.length,
    volumeBaisa: sumBaisa(deals.map((d) => d.unitValueBaisa)),
    grossCommissionBaisa: sumBaisa(deals.map((d) => d.grossCommissionBaisa)),
    referralBaisa: sumBaisa(deals.map((d) => d.referralBaisa)),
    agentShareBaisa: sumBaisa(deals.map((d) => d.agentAmountBaisa)),
    incentiveBaisa: sumBaisa(deals.map((d) => d.incentiveBaisa)),
    companyNetBaisa: sumBaisa(deals.map(companyNet)),
  };
}

/**
 * Effective commission rate — gross commission as a fraction of volume, derived
 * from the actual book. Never hardcoded: it moves as the developer mix moves.
 */
export function effectiveCommissionRate(deals: readonly Deal[]): number | null {
  const t = totalsOf(deals);
  return ratio(t.grossCommissionBaisa, t.volumeBaisa);
}

/**
 * Company keep rate — what the company retains as a fraction of volume, after
 * advisor cuts and referrals. This is the rate break-even divides by.
 */
export function companyKeepRate(deals: readonly Deal[]): number | null {
  const t = totalsOf(deals);
  return ratio(t.companyNetBaisa, t.volumeBaisa);
}

/** Totals per month across a window, including months with no deals. */
export function totalsByMonth(
  deals: readonly Deal[],
  window: MonthWindow,
): { month: MonthKey; totals: DealTotals }[] {
  const buckets = new Map<MonthKey, Deal[]>();
  for (const month of monthRange(window.from, window.to)) buckets.set(month, []);
  for (const deal of deals) {
    const bucket = buckets.get(deal.month);
    if (bucket) bucket.push(deal);
  }
  return [...buckets.entries()].map(([month, ds]) => ({ month, totals: totalsOf(ds) }));
}

/** Referral amounts owed, grouped by payee — an open liability until settled. */
export function openReferralLiabilities(
  deals: readonly Deal[],
): { payee: string; amountBaisa: Baisa; dealRefs: string[] }[] {
  const byPayee = new Map<string, { amountBaisa: Baisa; dealRefs: string[] }>();
  for (const deal of deals) {
    if (deal.referralPayee === null || deal.referralBaisa === 0) continue;
    const entry = byPayee.get(deal.referralPayee) ?? { amountBaisa: 0, dealRefs: [] };
    entry.amountBaisa += deal.referralBaisa;
    entry.dealRefs.push(deal.ref);
    byPayee.set(deal.referralPayee, entry);
  }
  return [...byPayee.entries()]
    .map(([payee, v]) => ({ payee, ...v }))
    .sort((a, b) => b.amountBaisa - a.amountBaisa);
}

/**
 * Deals closed but not yet invoiced — the first stage of the cash gap.
 *
 * A deal whose money has already arrived is never awaiting an invoice, even
 * when the invoice column says "unknown". HUM-0004 is exactly that case:
 * collected, with its invoicing state never recorded. Listing it here would put
 * an already-paid deal on the CEO's "invoices to send" tick-list.
 */
export function awaitingInvoice(deals: readonly Deal[]): Deal[] {
  return deals.filter(
    (d) => d.stage === "SPA_SIGNED" && d.invoiced !== "yes" && d.collected !== "yes",
  );
}

/** Invoiced but not yet collected — the second stage of the cash gap. */
export function awaitingCollection(deals: readonly Deal[]): Deal[] {
  return deals.filter((d) => d.invoiced === "yes" && d.collected !== "yes");
}
