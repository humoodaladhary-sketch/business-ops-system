// Data provenance for the Investment Intelligence engine.
//
// Every figure that feeds an analysis is either verified against a record,
// estimated from a stated source, assumed by the user, or missing. The engine
// never upgrades a value's provenance on its own, and downstream layers (the
// qualification engine, the report, the AI narrative) treat provenance as
// load-bearing: a "meets objective" verdict built on assumed rent is reported
// with lower confidence than the same verdict on verified rent. This mirrors
// the repo-wide honesty rule (`no_touch_recorded`, `due_date_unverified`):
// missing data is its own class — never guessed into a number.

/** How a value entered the analysis. Order matters: earlier = more trusted. */
export type Provenance = "verified" | "observed" | "estimated" | "assumed" | "missing";

/** A single tracked input value with its provenance. */
export interface SourcedValue {
  /** Stable key, e.g. "askingPriceOmr", "monthlyRentOmr". */
  key: string;
  /** Human label for reports, e.g. "Asking price". */
  label: string;
  /** The value; null when provenance is "missing". */
  value: number | string | null;
  provenance: Provenance;
  /** Where the value came from, e.g. "Live inventory unit AW-104", "Owner estimate". */
  source?: string;
  /** ISO date the value was verified/collected, when known. */
  verifiedAt?: string;
}

export interface DataQualitySummary {
  /** 0–100: share of tracked fields that are verified/observed, weighted. */
  score: number;
  verifiedFields: string[];
  estimatedFields: string[];
  assumedFields: string[];
  missingFields: string[];
}

const PROVENANCE_WEIGHT: Record<Provenance, number> = {
  verified: 1,
  observed: 1,
  estimated: 0.6,
  assumed: 0.35,
  missing: 0,
};

/**
 * Scores data quality 0–100 from tracked fields. Verified/observed count in
 * full, estimated at 60%, assumed at 35%, missing at 0. An empty list scores 0
 * (no data is not good data).
 */
export function summarizeDataQuality(fields: SourcedValue[]): DataQualitySummary {
  const summary: DataQualitySummary = {
    score: 0,
    verifiedFields: [],
    estimatedFields: [],
    assumedFields: [],
    missingFields: [],
  };
  if (fields.length === 0) return summary;

  let weight = 0;
  for (const f of fields) {
    weight += PROVENANCE_WEIGHT[f.provenance];
    switch (f.provenance) {
      case "verified":
      case "observed":
        summary.verifiedFields.push(f.key);
        break;
      case "estimated":
        summary.estimatedFields.push(f.key);
        break;
      case "assumed":
        summary.assumedFields.push(f.key);
        break;
      case "missing":
        summary.missingFields.push(f.key);
        break;
    }
  }
  summary.score = Math.round((weight / fields.length) * 100);
  return summary;
}
