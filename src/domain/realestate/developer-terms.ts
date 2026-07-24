// Payment-plan terms per developer. The Alwalaa standard is 5% reservation,
// 15% down payment, and the balance over 5 years in quarterly instalments.
// Developers can differ, so terms are looked up by developer name with a safe
// default — every unknown developer uses DEFAULT_TERMS. Add overrides here (or,
// later, from Settings) as real developer terms are confirmed.

export interface DeveloperTerms {
  /** Reservation deposit as a fraction of price (0.05 = 5%). */
  reservationPct: number;
  /** Down payment as a fraction of price (0.15 = 15%). */
  downPct: number;
  /** Years the balance is spread over. */
  years: number;
  /** Instalments per year (4 = quarterly). */
  installmentsPerYear: number;
}

/** The Alwalaa standard: 5% reservation, 15% down, balance over 5 years (quarterly). */
export const DEFAULT_TERMS: DeveloperTerms = {
  reservationPct: 0.05,
  downPct: 0.15,
  years: 5,
  installmentsPerYear: 4,
};

// Per-developer overrides, keyed by a normalized developer name (lowercase,
// alphanumerics only). Empty means every developer uses the standard plan;
// add an entry when a developer's real terms differ, e.g.:
//   ahlysabbour: { reservationPct: 0.1, downPct: 0.2, years: 4, installmentsPerYear: 4 }
export const DEVELOPER_TERMS: Record<string, DeveloperTerms> = {};

function normalizeDeveloper(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Payment terms for a developer, falling back to the Alwalaa standard 5/15/5y plan. */
export function termsForDeveloper(developer?: string): DeveloperTerms {
  if (!developer) return DEFAULT_TERMS;
  return DEVELOPER_TERMS[normalizeDeveloper(developer)] ?? DEFAULT_TERMS;
}
