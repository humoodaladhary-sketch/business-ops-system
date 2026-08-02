// Acquisition-cost engine: what it really costs to buy, and how much cash the
// investor must put in. Pure and deterministic. Money is OMR (3 dp); percents
// are whole percents (3 = 3%) matching the repo's calculator convention.
import { d, roundOMR, sumOMR } from "../../money";

/** One itemized acquisition cost line (registration, legal, furnishing, …). */
export interface CostLine {
  /** Stable key, e.g. "registrationFee". */
  key: string;
  /** Human label for reports. */
  label: string;
  /** Amount in OMR. Zero lines are kept (they document what was considered). */
  amountOmr: number;
}

export interface AcquisitionInput {
  /** The price being analyzed (negotiated price when set, else asking). */
  priceOmr: number;
  /** Itemized one-off costs on top of price: fees, furnishing, renovation, deposits, insurance… */
  costLines: CostLine[];
  /** Contingency as a whole percent of the itemized costs (10 = 10%). Default 0. */
  contingencyPct?: number;
  /** Loan/financed amount against the price. 0 or absent = all-cash. */
  financedOmr?: number;
  /** Built-up area for per-m² figures. */
  areaSqm?: number;
}

export interface AcquisitionResult {
  priceOmr: number;
  /** Sum of the itemized cost lines (before contingency), OMR. */
  itemizedCostsOmr: number;
  /** Contingency amount in OMR (contingencyPct × itemized costs). */
  contingencyOmr: number;
  /** price + itemized costs + contingency. */
  totalAcquisitionCostOmr: number;
  /** Total cash the investor must fund: total acquisition cost − financed amount. */
  totalCashRequiredOmr: number;
  /** Acquisition costs (excl. price) as a whole percent of price; null when price is 0. */
  acquisitionCostPct: number | null;
  /** Total acquisition cost per m²; null when area unknown/0. */
  costPerSqmOmr: number | null;
  /** Price per m²; null when area unknown/0. */
  pricePerSqmOmr: number | null;
  /** Equity at close: price − financed amount (fees are sunk cost, not equity). */
  initialEquityOmr: number;
  /** The cost lines echoed back (with contingency appended when > 0) for display/explain. */
  lines: CostLine[];
}

/** Round a percentage value to 2 dp, half-up. */
export function roundPct(value: number): number {
  return d(value).toDecimalPlaces(2).toNumber();
}

/**
 * Total acquisition cost and cash requirement.
 *
 * totalAcquisitionCost = price + Σ costLines + contingency
 * totalCashRequired    = totalAcquisitionCost − financed
 * initialEquity        = price − financed
 *
 * A financed amount larger than the total acquisition cost floors the cash
 * requirement at 0 (cash-out financing is out of scope). Negative equity is
 * reported as-is: financing above price is a data-entry error worth seeing.
 */
export function acquisitionCosts(input: AcquisitionInput): AcquisitionResult {
  const { priceOmr, costLines, contingencyPct = 0, financedOmr = 0, areaSqm } = input;

  const itemizedCostsOmr = sumOMR(costLines.map((l) => l.amountOmr));
  const contingencyOmr = roundOMR(d(itemizedCostsOmr).times(contingencyPct).dividedBy(100));
  const totalAcquisitionCostOmr = sumOMR([priceOmr, itemizedCostsOmr, contingencyOmr]);
  const totalCashRequiredOmr = Math.max(0, roundOMR(d(totalAcquisitionCostOmr).minus(financedOmr)));

  const lines = [...costLines];
  if (contingencyOmr > 0) {
    lines.push({ key: "contingency", label: `Contingency (${contingencyPct}%)`, amountOmr: contingencyOmr });
  }

  return {
    priceOmr,
    itemizedCostsOmr,
    contingencyOmr,
    totalAcquisitionCostOmr,
    totalCashRequiredOmr,
    acquisitionCostPct:
      priceOmr > 0
        ? roundPct(d(itemizedCostsOmr).plus(contingencyOmr).dividedBy(priceOmr).times(100).toNumber())
        : null,
    costPerSqmOmr:
      areaSqm && areaSqm > 0 ? roundOMR(d(totalAcquisitionCostOmr).dividedBy(areaSqm)) : null,
    pricePerSqmOmr: areaSqm && areaSqm > 0 ? roundOMR(d(priceOmr).dividedBy(areaSqm)) : null,
    initialEquityOmr: roundOMR(d(priceOmr).minus(financedOmr)),
    lines,
  };
}
