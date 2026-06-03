/**
 * OMR money formatting — pure, deterministic, no locale surprises.
 * Used by domain, UI, and API so every "OMR ..." string is identical.
 */

const omrFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const omrFormatterPrecise = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** "OMR 108,500" — whole rials. Null becomes an em dash. */
export function formatOmr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `OMR ${omrFormatter.format(Math.round(value))}`;
}

/** "OMR 108,500.000" — for per-unit precision where baisa matter. */
export function formatOmrPrecise(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `OMR ${omrFormatterPrecise.format(value)}`;
}

/** "1,234 /sqm" style helper for price-per-sqm. */
export function formatPerSqm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `OMR ${omrFormatter.format(Math.round(value))}/sqm`;
}

/** Percentage with one decimal, signed. */
export function formatPct(value: number | null | undefined, signed = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
