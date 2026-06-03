// Exact money math for OMR. The Omani Rial has 3 decimal places (1 OMR = 1000
// baisa), so every monetary result is rounded to 3 dp, half-up, via decimal.js.
// No JS float multiplication chains are allowed near commission math.
import Decimal from "decimal.js";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export const OMR_DP = 3;

export function d(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/** Round to OMR baisa (3 dp), half-up. */
export function roundOMR(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(OMR_DP, Decimal.ROUND_HALF_UP).toNumber();
}

/** Multiply a money amount by a rate fraction; return an OMR-rounded number. */
export function applyRate(amount: Decimal.Value, rate: Decimal.Value): number {
  return roundOMR(new Decimal(amount).times(rate));
}

/** Sum money values exactly, then round to OMR. */
export function sumOMR(values: Decimal.Value[]): number {
  return roundOMR(values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)));
}

/** Ratio (fraction) — not money. Guards divide-by-zero. */
export function ratioOf(numerator: Decimal.Value, denominator: Decimal.Value): number {
  const den = new Decimal(denominator);
  if (den.isZero()) return 0;
  return new Decimal(numerator).dividedBy(den).toNumber();
}

/** Convert a percent (e.g. 3.5, 50) to a fraction (0.035, 0.5). */
export function pctToFraction(pct: Decimal.Value): number {
  return new Decimal(pct).dividedBy(100).toNumber();
}
