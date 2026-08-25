// Comparable-property statistics. Pure and deterministic — the module only
// summarizes comparables the user selected or imported (CSV/JSON/manual); it
// never fabricates a comp. Every comp carries provenance (source + dates) and
// the summary's confidence is derived from sample size and dispersion.
import { d, roundOMR } from "../../money";
import { roundPct } from "./acquisition";

export interface ComparableProperty {
  /** Free-form identifier from the source (listing ref, unit ref…). */
  reference: string;
  project: string;
  unitType?: string;
  bedrooms?: number | null;
  areaSqm: number;
  askingPriceOmr?: number | null;
  /** Actual transaction price when known — always preferred over asking. */
  transactionPriceOmr?: number | null;
  monthlyRentOmr?: number | null;
  annualRentOmr?: number | null;
  dailyRateOmr?: number | null;
  occupancyPct?: number | null;
  /** Straight-line distance from the subject, km (computed upstream when coords exist). */
  distanceKm?: number | null;
  listingDate?: string;
  dataSource: string;
  verifiedAt?: string;
  /** observed = live listing/closing record; estimated/assumed per provenance rules. */
  provenance: "observed" | "estimated" | "assumed";
}

export interface ComparableSummary {
  count: number;
  /** Based on transaction price when present, else asking. */
  avgPriceOmr: number | null;
  medianPriceOmr: number | null;
  avgPricePerSqmOmr: number | null;
  medianPricePerSqmOmr: number | null;
  /** Annualized rent per m² (monthly×12 or annual, whichever the comp carries). */
  medianRentPerSqmOmr: number | null;
  /** Gross yield range across comps that have both price and rent, whole percents. */
  yieldRange: { minPct: number; maxPct: number; medianPct: number } | null;
  /** Subject price/m² vs comp median, whole percent (+ = subject is dearer). */
  subjectPremiumPct: number | null;
  /** Median comp price/m² × subject area — the comp-implied value. */
  adjustedValueOmr: number | null;
  confidence: "high" | "medium" | "low" | "insufficient";
  notes: string[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Price basis for a comp: transaction when present, else asking; null when neither. */
function priceOf(c: ComparableProperty): number | null {
  if (c.transactionPriceOmr != null && c.transactionPriceOmr > 0) return c.transactionPriceOmr;
  if (c.askingPriceOmr != null && c.askingPriceOmr > 0) return c.askingPriceOmr;
  return null;
}

/** Annual rent for a comp from whichever field it carries; null when none. */
function annualRentOf(c: ComparableProperty): number | null {
  if (c.annualRentOmr != null && c.annualRentOmr > 0) return c.annualRentOmr;
  if (c.monthlyRentOmr != null && c.monthlyRentOmr > 0) return c.monthlyRentOmr * 12;
  return null;
}

/**
 * Summarizes a comparable set against the subject.
 *
 * Confidence: insufficient (<2 usable comps), low (2 comps or price/m² spread
 * > 40% of median), medium (3–4 comps within spread), high (≥5 comps and
 * spread ≤ 25%). Transaction prices upgrade nothing by themselves but are
 * noted — asking-only samples carry a note that asking ≠ achieved.
 */
export function summarizeComparables(
  comps: ComparableProperty[],
  subject: { areaSqm: number; priceOmr: number },
): ComparableSummary {
  const priced = comps.filter((c) => priceOf(c) != null && c.areaSqm > 0);
  const prices = priced.map((c) => priceOf(c) as number);
  const psms = priced.map((c) => (priceOf(c) as number) / c.areaSqm);

  const rents = comps
    .map((c) => ({ rent: annualRentOf(c), area: c.areaSqm }))
    .filter((r): r is { rent: number; area: number } => r.rent != null && r.area > 0);
  const rentPsms = rents.map((r) => r.rent / r.area);

  const yields: number[] = [];
  for (const c of comps) {
    const price = priceOf(c);
    const rent = annualRentOf(c);
    if (price != null && rent != null && price > 0) {
      yields.push((rent / price) * 100);
    }
  }

  const medianPsm = median(psms);
  const subjectPsm = subject.areaSqm > 0 ? subject.priceOmr / subject.areaSqm : null;

  const notes: string[] = [];
  const transactionCount = priced.filter(
    (c) => c.transactionPriceOmr != null && c.transactionPriceOmr > 0,
  ).length;
  if (priced.length > 0 && transactionCount === 0) {
    notes.push("All comparable prices are ASKING prices — achieved prices are typically lower.");
  } else if (transactionCount > 0) {
    notes.push(`${transactionCount} of ${priced.length} comparables carry actual transaction prices.`);
  }

  let confidence: ComparableSummary["confidence"];
  if (priced.length < 2) {
    confidence = "insufficient";
    notes.push("Fewer than 2 usable comparables — treat every comp-derived figure as indicative only.");
  } else {
    const spread =
      medianPsm != null && medianPsm > 0 ? (Math.max(...psms) - Math.min(...psms)) / medianPsm : 1;
    if (priced.length >= 5 && spread <= 0.25) confidence = "high";
    else if (priced.length >= 3 && spread <= 0.4) confidence = "medium";
    else confidence = "low";
    if (spread > 0.4) notes.push("Wide price dispersion across comparables — the sample mixes unlike stock.");
  }

  const yieldMedian = median(yields);

  return {
    count: comps.length,
    avgPriceOmr: prices.length > 0 ? roundOMR(mean(prices) as number) : null,
    medianPriceOmr: prices.length > 0 ? roundOMR(median(prices) as number) : null,
    avgPricePerSqmOmr: psms.length > 0 ? roundOMR(mean(psms) as number) : null,
    medianPricePerSqmOmr: medianPsm != null ? roundOMR(medianPsm) : null,
    medianRentPerSqmOmr: rentPsms.length > 0 ? roundOMR(median(rentPsms) as number) : null,
    yieldRange:
      yields.length > 0
        ? {
            minPct: roundPct(Math.min(...yields)),
            maxPct: roundPct(Math.max(...yields)),
            medianPct: roundPct(yieldMedian as number),
          }
        : null,
    subjectPremiumPct:
      subjectPsm != null && medianPsm != null && medianPsm > 0
        ? roundPct(((subjectPsm - medianPsm) / medianPsm) * 100)
        : null,
    adjustedValueOmr:
      medianPsm != null && subject.areaSqm > 0 ? roundOMR(d(medianPsm).times(subject.areaSqm)) : null,
    confidence,
    notes,
  };
}

/** Straight-line (haversine) distance between two coordinates, km (2 dp). */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}
