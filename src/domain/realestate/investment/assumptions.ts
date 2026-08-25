// Configurable Oman acquisition-cost and fee assumptions.
//
// Government fees, legal thresholds and typical closing costs CHANGE. They are
// therefore never hardcoded into the calculation engine — the engine only ever
// receives explicit numbers. This registry supplies editable DEFAULTS, each
// carrying its source and effective date so a report can state exactly which
// assumption set produced its figures. The UI (and the Settings store) may
// override any default; overrides keep the same shape so provenance survives.

export interface FeeAssumption {
  /** Stable key, e.g. "registrationFeePct". */
  key: string;
  /** Human label, e.g. "Ministry of Housing registration fee". */
  label: string;
  /** "pctOfPrice" values are whole percents of the purchase price; "fixedOmr" are OMR amounts. */
  kind: "pctOfPrice" | "fixedOmr";
  /** Default value: whole percent for pctOfPrice (3 = 3%), OMR for fixedOmr. */
  value: number;
  /** Where the default comes from. Never presented as verified law. */
  source: string;
  /** ISO date the default was last reviewed. */
  effectiveDate: string;
  note?: string;
}

/**
 * Default acquisition-fee assumptions for an Oman purchase. These are STARTING
 * POINTS for the analyst to confirm per deal — not legal advice and not
 * guaranteed current rates. Every report lists the set used, with dates.
 */
export const DEFAULT_FEE_ASSUMPTIONS: FeeAssumption[] = [
  {
    key: "registrationFeePct",
    label: "Registration fee (Ministry of Housing & Urban Planning)",
    kind: "pctOfPrice",
    value: 3,
    source: "Alwalaa operating assumption — confirm current MoHUP rate per transaction",
    effectiveDate: "2026-08-01",
    note: "Applied to the purchase price at transfer. ITC transactions may differ; verify before closing.",
  },
  {
    key: "agencyFeePct",
    label: "Agency fee",
    kind: "pctOfPrice",
    value: 0,
    source: "Alwalaa standard — developer-paid commission on primary sales; buyer-side fee only when agreed in writing",
    effectiveDate: "2026-08-01",
  },
  {
    key: "legalFeesOmr",
    label: "Legal / conveyancing fees",
    kind: "fixedOmr",
    value: 500,
    source: "Alwalaa operating assumption — typical Muscat conveyancing engagement",
    effectiveDate: "2026-08-01",
  },
  {
    key: "valuationFeeOmr",
    label: "Bank valuation fee",
    kind: "fixedOmr",
    value: 100,
    source: "Alwalaa operating assumption — typical bank panel valuation",
    effectiveDate: "2026-08-01",
    note: "Only applies when financing with a mortgage.",
  },
  {
    key: "mortgageArrangementPct",
    label: "Mortgage arrangement fee",
    kind: "pctOfPrice",
    value: 0,
    source: "Bank-specific — enter the quoted arrangement fee; often ~1% of the loan",
    effectiveDate: "2026-08-01",
    note: "Entered against the LOAN amount in the financing step when quoted as % of loan.",
  },
];

/** Look up a default assumption by key; undefined when not in the registry. */
export function feeAssumption(key: string): FeeAssumption | undefined {
  return DEFAULT_FEE_ASSUMPTIONS.find((a) => a.key === key);
}
