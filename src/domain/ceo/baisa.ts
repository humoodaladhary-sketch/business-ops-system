// Money for the CEO Command Center.
//
// The Omani Rial has three decimals: 1 OMR = 1000 baisa. Every monetary value
// in this module is an INTEGER NUMBER OF BAISA. No floats, ever — a float
// cannot represent 0.1 OMR, and a rounding drift of one baisa per deal is a
// rounding drift of thirty-eight baisa across the 2026 book.
//
// Conversion happens only at the edges: parsing input (`omrStringToBaisa`) and
// rendering output (`formatOmr`). Everything in between is integer arithmetic.
//
// Naming rule enforced by convention across this module: any variable or field
// holding baisa ends in `Baisa`. If it does not, it is not money.

/** An integer number of baisa. 1 OMR = 1000 baisa. */
export type Baisa = number;

export const BAISA_PER_OMR = 1000;
export const OMR_DECIMALS = 3;

export class MoneyParseError extends Error {}

/**
 * Parse a decimal OMR string to integer baisa without ever touching a float.
 * Accepts "1234", "1234.5", "1234.567", "-12.5", "", " 1,234.560 ".
 * More than three decimals is an error rather than a silent truncation — the
 * source data is authoritative and a fourth decimal means it is not what we think.
 */
export function omrStringToBaisa(raw: string): Baisa {
  const s = raw.trim().replace(/,/g, "");
  if (s === "" || s === "-") return 0;
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) throw new MoneyParseError(`Not a decimal OMR amount: ${JSON.stringify(raw)}`);
  const [, sign, intPart, fracPart = ""] = m;
  if (intPart === "" && fracPart === "") {
    throw new MoneyParseError(`Not a decimal OMR amount: ${JSON.stringify(raw)}`);
  }
  if (fracPart.length > OMR_DECIMALS) {
    throw new MoneyParseError(
      `More than ${OMR_DECIMALS} decimals in OMR amount ${JSON.stringify(raw)} — ` +
        `refusing to silently truncate sub-baisa precision.`,
    );
  }
  const units = intPart === "" ? 0 : Number(intPart);
  const frac = Number(fracPart.padEnd(OMR_DECIMALS, "0") || "0");
  const magnitude = units * BAISA_PER_OMR + frac;
  if (!Number.isSafeInteger(magnitude)) {
    throw new MoneyParseError(`OMR amount out of safe integer range: ${JSON.stringify(raw)}`);
  }
  return sign === "-" ? -magnitude : magnitude;
}

/** Convert a whole/decimal OMR number to baisa. Use only for authored constants. */
export function omrToBaisa(omr: number): Baisa {
  if (!Number.isFinite(omr)) throw new MoneyParseError(`Not a finite OMR amount: ${omr}`);
  return Math.round(omr * BAISA_PER_OMR);
}

/** Baisa back to an OMR float. Presentation only — never feed this back into maths. */
export function baisaToOmr(b: Baisa): number {
  return b / BAISA_PER_OMR;
}

export function assertBaisa(b: Baisa, what = "value"): Baisa {
  if (!Number.isSafeInteger(b)) {
    throw new MoneyParseError(`${what} is not an integer baisa amount: ${b}`);
  }
  return b;
}

export function sumBaisa(values: readonly Baisa[]): Baisa {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Apply a percentage to a baisa amount, half-up to the nearest baisa.
 * `pct` is a percent (3.5 means 3.5%), matching how the source data stores it.
 */
export function applyPct(amountBaisa: Baisa, pct: number): Baisa {
  return roundHalfUp((amountBaisa * pct) / 100);
}

/** Half-up rounding that behaves symmetrically for negatives (−0.5 → −1). */
export function roundHalfUp(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/**
 * A ratio between two baisa amounts, as a plain number. Returns null when the
 * denominator is zero — a return of "Infinity" or "0" would both be lies.
 */
export function ratio(numeratorBaisa: Baisa, denominatorBaisa: Baisa): number | null {
  if (denominatorBaisa === 0) return null;
  return numeratorBaisa / denominatorBaisa;
}

/** Format baisa as an OMR string. Rounds half-up when fewer than 3 decimals. */
export function formatOmr(b: Baisa, opts: { decimals?: number; grouping?: boolean } = {}): string {
  const decimals = Math.min(Math.max(opts.decimals ?? OMR_DECIMALS, 0), OMR_DECIMALS);
  const grouping = opts.grouping ?? true;
  const scale = 10 ** (OMR_DECIMALS - decimals);
  const rounded = roundHalfUp(b / scale) * scale;
  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const units = Math.floor(abs / BAISA_PER_OMR);
  const frac = String(abs % BAISA_PER_OMR).padStart(OMR_DECIMALS, "0");
  // Western digits in both languages, per the bilingual rule.
  const head = grouping ? units.toLocaleString("en-US") : String(units);
  const body = decimals === 0 ? head : `${head}.${frac.slice(0, decimals)}`;
  return neg && rounded !== 0 ? `-${body}` : body;
}
