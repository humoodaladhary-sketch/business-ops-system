// Reverse price solver: at what price would this deal meet the investor's
// targets? Pure and deterministic. The solver never invents a market value —
// every output is labeled an ANALYTICAL estimate derived from the entered
// assumptions, not a valuation.
//
// Return metrics (yield, cap rate, CoC, IRR) fall as price rises and the cash
// requirement rises with price, so each target admits a monotone bisection on
// price. Closed forms are used where exact (gross/net yield, cap rate).
import { d, roundOMR } from "../../money";

/** The metrics the solver can target, re-evaluated at a candidate price. */
export interface PricePointMetrics {
  grossYieldPct: number | null;
  netYieldPct: number | null;
  capRatePct: number | null;
  cashOnCashPct: number | null;
  irrPct: number | null;
  monthlyCashFlowOmr: number | null;
  totalCashRequiredOmr: number | null;
}

export type OfferTargetKey =
  | "grossYield"
  | "netYield"
  | "capRate"
  | "cashOnCash"
  | "irr"
  | "monthlyCashFlow"
  | "affordability";

export interface OfferTarget {
  key: OfferTargetKey;
  /** Whole percent for return targets; OMR for monthlyCashFlow / affordability. */
  value: number;
}

export interface OfferSolverInput {
  askingPriceOmr: number;
  negotiatedPriceOmr?: number | null;
  targets: OfferTarget[];
  /**
   * Deterministic re-evaluation of the deal at a candidate price. The
   * orchestrator's closure scales percent-driven financing (LTV loans,
   * payment plans) with the candidate price while holding itemized OMR cost
   * lines constant — conservative at lower prices, where real percentage
   * fees would fall too.
   */
  evaluate: (priceOmr: number) => PricePointMetrics;
  /** Opening offer sits this far below the justified price, whole percent. Default 5. */
  openingMarginPct?: number;
}

export interface TargetSolution {
  key: OfferTargetKey;
  targetValue: number;
  /** Highest price at which the target is met; null when unreachable in range. */
  maxPriceOmr: number | null;
}

export interface OfferRecommendation {
  askingPriceOmr: number;
  negotiatedPriceOmr: number | null;
  perTarget: TargetSolution[];
  /** min over solved targets — the price where EVERY stated target is met. */
  maximumJustifiedPriceOmr: number | null;
  suggestedOpeningOfferOmr: number | null;
  suggestedRange: { minimumOmr: number; maximumOmr: number } | null;
  walkAwayPriceOmr: number | null;
  /** Asking − justified, OMR and as whole percent of asking (positive = discount needed). */
  discountRequiredOmr: number | null;
  discountRequiredPct: number | null;
  /** Metrics at the key price points for the comparison table. */
  metricsAt: { label: string; priceOmr: number; metrics: PricePointMetrics }[];
  disclaimer: string;
}

const DISCLAIMER =
  "Analytical estimate derived from the entered assumptions — not a market valuation, " +
  "an appraisal, or a guarantee of achievable price.";

/** Metric direction: return metrics fall with price; cash required rises. */
function metricFor(key: OfferTargetKey, m: PricePointMetrics): number | null {
  switch (key) {
    case "grossYield":
      return m.grossYieldPct;
    case "netYield":
      return m.netYieldPct;
    case "capRate":
      return m.capRatePct;
    case "cashOnCash":
      return m.cashOnCashPct;
    case "irr":
      return m.irrPct;
    case "monthlyCashFlow":
      return m.monthlyCashFlowOmr;
    case "affordability":
      return m.totalCashRequiredOmr;
  }
}

/** True when the metric at this price satisfies the target. */
function satisfied(key: OfferTargetKey, target: number, value: number | null): boolean {
  if (value == null) return false;
  return key === "affordability" ? value <= target : value >= target;
}

/**
 * Solves each target by bisection on [floor, ceiling] where floor = 5% of
 * asking (a deal below that is a data error, not a negotiation) and ceiling =
 * 3× asking (covers "meets the target even above asking"). 48 iterations give
 * sub-rial precision. Results are rounded DOWN to the nearest 100 OMR — an
 * offer of 142,358.117 OMR is noise, 142,300 is a usable number.
 */
export function solveOffer(input: OfferSolverInput): OfferRecommendation {
  const { askingPriceOmr, negotiatedPriceOmr = null, targets, evaluate, openingMarginPct = 5 } = input;

  const floor = Math.max(1000, askingPriceOmr * 0.05);
  const ceiling = Math.max(askingPriceOmr * 3, floor + 1000);

  const perTarget: TargetSolution[] = targets.map((t) => {
    // If even the floor price cannot satisfy the target, it is unreachable.
    if (!satisfied(t.key, t.value, metricFor(t.key, evaluate(floor)))) {
      return { key: t.key, targetValue: t.value, maxPriceOmr: null };
    }
    // If the ceiling satisfies it, the target binds nowhere in range.
    if (satisfied(t.key, t.value, metricFor(t.key, evaluate(ceiling)))) {
      return { key: t.key, targetValue: t.value, maxPriceOmr: roundTo100(ceiling) };
    }
    let lo = floor; // satisfied
    let hi = ceiling; // not satisfied
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (satisfied(t.key, t.value, metricFor(t.key, evaluate(mid)))) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return { key: t.key, targetValue: t.value, maxPriceOmr: roundTo100(lo) };
  });

  const solved = perTarget.filter((t) => t.maxPriceOmr != null).map((t) => t.maxPriceOmr as number);
  const justified = perTarget.length > 0 && solved.length === perTarget.length ? Math.min(...solved) : null;

  const opening =
    justified != null ? roundTo100(d(justified).times(d(100).minus(openingMarginPct).dividedBy(100)).toNumber()) : null;

  const metricsAt: OfferRecommendation["metricsAt"] = [
    { label: "Asking price", priceOmr: askingPriceOmr, metrics: evaluate(askingPriceOmr) },
  ];
  if (negotiatedPriceOmr != null && negotiatedPriceOmr > 0 && negotiatedPriceOmr !== askingPriceOmr) {
    metricsAt.push({ label: "Negotiated price", priceOmr: negotiatedPriceOmr, metrics: evaluate(negotiatedPriceOmr) });
  }
  if (justified != null) {
    metricsAt.push({ label: "Maximum justified", priceOmr: justified, metrics: evaluate(justified) });
  }
  if (opening != null && opening !== justified) {
    metricsAt.push({ label: "Opening offer", priceOmr: opening, metrics: evaluate(opening) });
  }

  return {
    askingPriceOmr,
    negotiatedPriceOmr,
    perTarget,
    maximumJustifiedPriceOmr: justified,
    suggestedOpeningOfferOmr: opening,
    suggestedRange: justified != null && opening != null ? { minimumOmr: opening, maximumOmr: justified } : null,
    walkAwayPriceOmr: justified,
    discountRequiredOmr: justified != null ? roundOMR(d(askingPriceOmr).minus(justified)) : null,
    discountRequiredPct:
      justified != null && askingPriceOmr > 0
        ? d(askingPriceOmr).minus(justified).dividedBy(askingPriceOmr).times(100).toDecimalPlaces(2).toNumber()
        : null,
    metricsAt,
    disclaimer: DISCLAIMER,
  };
}

/** Round a price down to the nearest 100 OMR (negotiation-usable figure). */
function roundTo100(priceOmr: number): number {
  return Math.floor(priceOmr / 100) * 100;
}
