// Dates, months and the Omani working week.
//
// The working week is Sunday–Thursday. Pacing a month on calendar days when
// two of every seven are weekend days overstates elapsed time by up to 40%,
// which turns a healthy month into a false alarm. Everything here counts
// working days.
//
// Timezone is Asia/Muscat (UTC+4, no DST). To keep that from leaking into the
// arithmetic, dates are handled as plain `YYYY-MM-DD` strings and compared as
// UTC instants — never as local `new Date()` values.

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** A calendar month, `YYYY-MM`. */
export type MonthKey = string;

export const TIMEZONE = "Asia/Muscat";
/** JS `getUTCDay()` values that are working days: Sunday(0)–Thursday(4). */
export const WORKING_WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4];
/**
 * Pace is meaningless in the first days of a month: with one or two working
 * days elapsed a single deal swings the index wildly. Below this, report "not
 * yet measurable" rather than a number.
 */
export const MIN_WORKING_DAYS_FOR_PACE = 3;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export class DateParseError extends Error {}

export function parseIsoDate(date: IsoDate): { y: number; m: number; d: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new DateParseError(`Expected YYYY-MM-DD, got ${JSON.stringify(date)}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function parseMonthKey(month: MonthKey): { y: number; m: number } {
  const m = MONTH_RE.exec(month);
  if (!m) throw new DateParseError(`Expected YYYY-MM, got ${JSON.stringify(month)}`);
  const mm = Number(m[2]);
  if (mm < 1 || mm > 12) throw new DateParseError(`Month out of range: ${month}`);
  return { y: Number(m[1]), m: mm };
}

/** The month a date falls in. */
export function monthOf(date: IsoDate): MonthKey {
  return date.slice(0, 7);
}

export function toUtc(date: IsoDate): number {
  const { y, m, d } = parseIsoDate(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function firstDayOfMonth(month: MonthKey): IsoDate {
  parseMonthKey(month);
  return `${month}-01`;
}

export function lastDayOfMonth(month: MonthKey): IsoDate {
  const { y, m } = parseMonthKey(month);
  return fromUtc(Date.UTC(y, m, 0));
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const { y, m } = parseMonthKey(month);
  const total = y * 12 + (m - 1) + delta;
  const yy = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}`;
}

/** Inclusive count of calendar months from `from` to `to`. Zero if `to` < `from`. */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const a = parseMonthKey(from);
  const b = parseMonthKey(to);
  const n = (b.y * 12 + b.m) - (a.y * 12 + a.m) + 1;
  return n > 0 ? n : 0;
}

/** Inclusive list of months from `from` to `to`. Empty if `to` < `from`. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  const n = monthsBetween(from, to);
  for (let i = 0; i < n; i += 1) out.push(addMonths(from, i));
  return out;
}

export function isWorkingDay(date: IsoDate, holidays: ReadonlySet<IsoDate> = new Set()): boolean {
  if (holidays.has(date)) return false;
  return WORKING_WEEKDAYS.includes(new Date(toUtc(date)).getUTCDay());
}

/** Working days in the inclusive range [from, to]. */
export function workingDaysBetween(
  from: IsoDate,
  to: IsoDate,
  holidays: ReadonlySet<IsoDate> = new Set(),
): number {
  if (compareDates(from, to) > 0) return 0;
  let count = 0;
  for (let ms = toUtc(from); ms <= toUtc(to); ms += 86_400_000) {
    if (isWorkingDay(fromUtc(ms), holidays)) count += 1;
  }
  return count;
}

export function workingDaysInMonth(
  month: MonthKey,
  holidays: ReadonlySet<IsoDate> = new Set(),
): number {
  return workingDaysBetween(firstDayOfMonth(month), lastDayOfMonth(month), holidays);
}

export interface Pace {
  /** Working days completed in the period, up to and including `asOf`. */
  elapsed: number;
  /** Total working days in the period. */
  total: number;
  /** elapsed ÷ total, in [0, 1]. */
  fraction: number;
  /**
   * False before working day 3, or when the period has no working days at all.
   * When false, callers must show "لم يبدأ القياس / not yet measurable" and must
   * not render paceIndex or projection.
   */
  measurable: boolean;
}

/**
 * How far through a month we are, in working days. `asOf` before the month
 * starts gives 0 elapsed; after it ends gives a complete month.
 */
export function paceOfMonth(
  month: MonthKey,
  asOf: IsoDate,
  holidays: ReadonlySet<IsoDate> = new Set(),
): Pace {
  const start = firstDayOfMonth(month);
  const end = lastDayOfMonth(month);
  const total = workingDaysInMonth(month, holidays);
  const cutoff = compareDates(asOf, end) > 0 ? end : asOf;
  const elapsed = compareDates(cutoff, start) < 0 ? 0 : workingDaysBetween(start, cutoff, holidays);
  return {
    elapsed,
    total,
    fraction: total === 0 ? 0 : elapsed / total,
    measurable: total > 0 && elapsed >= MIN_WORKING_DAYS_FOR_PACE,
  };
}

/** Pace across an arbitrary inclusive date range — used for the quarter view. */
export function paceOfRange(
  from: IsoDate,
  to: IsoDate,
  asOf: IsoDate,
  holidays: ReadonlySet<IsoDate> = new Set(),
): Pace {
  const total = workingDaysBetween(from, to, holidays);
  const cutoff = compareDates(asOf, to) > 0 ? to : asOf;
  const elapsed = compareDates(cutoff, from) < 0 ? 0 : workingDaysBetween(from, cutoff, holidays);
  return {
    elapsed,
    total,
    fraction: total === 0 ? 0 : elapsed / total,
    measurable: total > 0 && elapsed >= MIN_WORKING_DAYS_FOR_PACE,
  };
}

/** The quarter a month belongs to, and its month span. */
export function quarterOf(month: MonthKey): { quarter: number; year: number; months: MonthKey[] } {
  const { y, m } = parseMonthKey(month);
  const quarter = Math.floor((m - 1) / 3) + 1;
  const firstMonth = `${y}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}`;
  return { quarter, year: y, months: monthRange(firstMonth, addMonths(firstMonth, 2)) };
}
