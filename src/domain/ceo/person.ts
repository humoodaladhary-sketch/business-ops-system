// The person card: cost, contribution, payback, direction.
//
// The rule that governs this file: a card only shows metrics the person's role
// owns. An advisor is scored on volume and deals. A marketing manager is not —
// rendering "0 deals" on her card is a bug, not a fact. `revenueScored` is the
// switch, and every revenue metric returns null for people it does not apply to.

import { type Baisa, ratio } from "./baisa";
import {
  type IsoDate,
  type MonthKey,
  type Pace,
  monthOf,
  monthRange,
  paceOfMonth,
  quarterOf,
} from "./calendar";
import { type CostBreakdown, personCost, personMonthlyCost, isEmployedInMonth } from "./cost";
import { type DealTotals, ZERO_TOTALS, companyNet, dealsForPerson, dealsInWindow, totalsOf } from "./deals";
import type { BonusBand, CompanySettings, CostPolicy, Deal, MonthWindow, Person, PersonClass } from "./types";

/**
 * Whether the company's income can be attributed to this person's own deals.
 * Support staff are scored on their own KPIs and never on contribution — but
 * their cost is still shown, because the CEO needs the full cost picture.
 */
export function isRevenueScored(personClass: PersonClass): boolean {
  return personClass === "Advisor" || personClass === "Owner";
}

/** Whether this person is ranked in the advisor league table. The founder is not. */
export function isRankedAgainstAdvisors(person: Person): boolean {
  return person.personClass === "Advisor";
}

export function isActiveOn(person: Person, asOf: IsoDate): boolean {
  if (person.endedAt !== null && person.endedAt < asOf) return false;
  return person.measurementStartDate <= asOf;
}

/** Tenure in whole months, from the measurement baseline to `asOf` (inclusive). */
export function tenureMonths(person: Person, asOf: IsoDate): number {
  const start = monthOf(person.measurementStartDate);
  const endMonth = person.endedAt !== null && person.endedAt < asOf ? monthOf(person.endedAt) : monthOf(asOf);
  let n = 0;
  for (const month of monthRange(start, endMonth)) if (isEmployedInMonth(person, month)) n += 1;
  return n;
}

/**
 * contribution(p, w) = Σ companyNet(their deals in w) − personCost(p, w)
 *
 * `broughtInBaisa` is null for people who are not revenue-scored: they brought
 * in nothing attributable, which is not the same as bringing in zero.
 */
export interface Contribution {
  window: MonthWindow;
  months: number;
  costBaisa: Baisa;
  costBreakdown: CostBreakdown;
  revenueScored: boolean;
  deals: DealTotals | null;
  broughtInBaisa: Baisa | null;
  /** brought in − cost. Null when not revenue-scored. */
  netBaisa: Baisa | null;
  /** brought in ÷ cost. Null when not revenue-scored, or cost is zero. */
  returnMultiple: number | null;
}

export function contribution(
  person: Person,
  deals: readonly Deal[],
  window: MonthWindow,
  policies: readonly CostPolicy[],
): Contribution {
  const cost = personCost(person, window, policies);
  const revenueScored = isRevenueScored(person.personClass);
  const own = revenueScored ? dealsInWindow(dealsForPerson(deals, person.id), window) : [];
  const totals = revenueScored ? totalsOf(own) : null;
  const broughtInBaisa = totals ? totals.companyNetBaisa : null;
  return {
    window,
    months: cost.months,
    costBaisa: cost.totalBaisa,
    costBreakdown: {
      basicBaisa: cost.basicBaisa,
      allowanceBaisa: cost.allowanceBaisa,
      socialInsuranceBaisa: cost.socialInsuranceBaisa,
      eosAccrualBaisa: cost.eosAccrualBaisa,
      totalBaisa: cost.totalBaisa,
    },
    revenueScored,
    deals: totals,
    broughtInBaisa,
    netBaisa: broughtInBaisa === null ? null : broughtInBaisa - cost.totalBaisa,
    returnMultiple: broughtInBaisa === null ? null : ratio(broughtInBaisa, cost.totalBaisa),
  };
}

/** Σ companyNet(all their deals) ÷ personCost(measurement start → today). */
export function lifetimeReturn(
  person: Person,
  deals: readonly Deal[],
  asOf: IsoDate,
  policies: readonly CostPolicy[],
): number | null {
  const c = contribution(person, deals, lifetimeWindow(person, asOf), policies);
  return c.returnMultiple;
}

export function lifetimeWindow(person: Person, asOf: IsoDate): MonthWindow {
  return { from: monthOf(person.measurementStartDate), to: monthOf(asOf) };
}

export interface MonthlyLedgerRow {
  month: MonthKey;
  costBaisa: Baisa;
  broughtInBaisa: Baisa;
  cumulativeCostBaisa: Baisa;
  cumulativeBroughtInBaisa: Baisa;
  /** True from the first month cumulative income covers cumulative cost onward. */
  paidBack: boolean;
}

/** Month-by-month cost and income for a person, cumulative — the payback trail. */
export function monthlyLedger(
  person: Person,
  deals: readonly Deal[],
  window: MonthWindow,
  policies: readonly CostPolicy[],
): MonthlyLedgerRow[] {
  const revenueScored = isRevenueScored(person.personClass);
  const own = revenueScored ? dealsForPerson(deals, person.id) : [];
  const netByMonth = new Map<MonthKey, Baisa>();
  for (const deal of own) {
    netByMonth.set(deal.month, (netByMonth.get(deal.month) ?? 0) + companyNet(deal));
  }
  const rows: MonthlyLedgerRow[] = [];
  let cumCost = 0;
  let cumNet = 0;
  let paidBack = false;
  for (const month of monthRange(window.from, window.to)) {
    if (!isEmployedInMonth(person, month)) continue;
    const costBaisa = personMonthlyCost(person, month, policies).totalBaisa;
    const broughtInBaisa = netByMonth.get(month) ?? 0;
    cumCost += costBaisa;
    cumNet += broughtInBaisa;
    if (!paidBack && revenueScored && cumNet >= cumCost) paidBack = true;
    rows.push({
      month,
      costBaisa,
      broughtInBaisa,
      cumulativeCostBaisa: cumCost,
      cumulativeBroughtInBaisa: cumNet,
      paidBack,
    });
  }
  return rows;
}

/**
 * The first month cumulative income crossed cumulative cost — or null for
 * "not yet". Null for people who are not revenue-scored: there is no payback
 * question to answer for a marketing manager.
 */
export function paybackMonth(
  person: Person,
  deals: readonly Deal[],
  asOf: IsoDate,
  policies: readonly CostPolicy[],
): MonthKey | null {
  if (!isRevenueScored(person.personClass)) return null;
  const rows = monthlyLedger(person, deals, lifetimeWindow(person, asOf), policies);
  for (const row of rows) {
    if (row.cumulativeBroughtInBaisa >= row.cumulativeCostBaisa) return row.month;
  }
  return null;
}

export type TrendDirection = "improving" | "declining" | "steady" | "not-measurable";

export interface Trend {
  direction: TrendDirection;
  /** Mean monthly contribution over the last three employed months. */
  recentMonthlyAvgBaisa: Baisa | null;
  /** Mean monthly contribution across their whole tenure. */
  lifetimeMonthlyAvgBaisa: Baisa | null;
  /** recent ÷ lifetime. 1.0 is flat. Null when not measurable. */
  index: number | null;
}

/**
 * Direction, not level. A person at 2.2x who is falling and a person at 2.2x
 * who is climbing are two different decisions, so the card must say which.
 * Compares the last three months' contribution against their own lifetime
 * average — never against anyone else's.
 */
export function trend(
  person: Person,
  deals: readonly Deal[],
  asOf: IsoDate,
  policies: readonly CostPolicy[],
  opts: { steadyBand?: number } = {},
): Trend {
  const steadyBand = opts.steadyBand ?? 0.1;
  const notMeasurable: Trend = {
    direction: "not-measurable",
    recentMonthlyAvgBaisa: null,
    lifetimeMonthlyAvgBaisa: null,
    index: null,
  };
  if (!isRevenueScored(person.personClass)) return notMeasurable;

  const rows = monthlyLedger(person, deals, lifetimeWindow(person, asOf), policies);
  if (rows.length < 4) return notMeasurable;

  const contributionOf = (r: MonthlyLedgerRow) => r.broughtInBaisa - r.costBaisa;
  const recent = rows.slice(-3);
  const recentAvg = recent.reduce((s, r) => s + contributionOf(r), 0) / recent.length;
  const lifetimeAvg = rows.reduce((s, r) => s + contributionOf(r), 0) / rows.length;
  if (lifetimeAvg === 0) return notMeasurable;

  const index = recentAvg / lifetimeAvg;
  // A negative lifetime average inverts the comparison: doing "more of a loss"
  // is declining, not improving.
  const relative = lifetimeAvg > 0 ? index : 2 - index;
  const direction: TrendDirection =
    relative > 1 + steadyBand ? "improving" : relative < 1 - steadyBand ? "declining" : "steady";

  return {
    direction,
    recentMonthlyAvgBaisa: Math.round(recentAvg),
    lifetimeMonthlyAvgBaisa: Math.round(lifetimeAvg),
    index,
  };
}

// --- Pace, projection, bonus ------------------------------------------------

/** paceIndex = (actual ÷ target) ÷ pace. Null before pace is measurable. */
export function paceIndex(actualBaisa: Baisa, targetBaisa: Baisa, pace: Pace): number | null {
  if (!pace.measurable || targetBaisa === 0 || pace.fraction === 0) return null;
  return actualBaisa / targetBaisa / pace.fraction;
}

/** projection = actual ÷ pace — where the month lands at this rate. */
export function projection(actualBaisa: Baisa, pace: Pace): Baisa | null {
  if (!pace.measurable || pace.fraction === 0) return null;
  return Math.round(actualBaisa / pace.fraction);
}

/** The bonus band a volume falls into. Bands come from settings, never from code. */
export function bandFor(volumeBaisa: Baisa, bands: readonly BonusBand[]): BonusBand | null {
  for (const band of bands) {
    const aboveMin = volumeBaisa >= band.minVolumeBaisa;
    const belowMax = band.maxVolumeBaisa === null || volumeBaisa < band.maxVolumeBaisa;
    if (aboveMin && belowMax) return band;
  }
  return null;
}

export interface MonthPerformance {
  month: MonthKey;
  revenueScored: boolean;
  pace: Pace;
  volumeBaisa: Baisa | null;
  targetBaisa: Baisa | null;
  paceIndex: number | null;
  projectedVolumeBaisa: Baisa | null;
  currentBand: BonusBand | null;
  projectedBand: BonusBand | null;
  costBaisa: Baisa;
  contributionBaisa: Baisa | null;
  deals: DealTotals | null;
}

/** The Month tab of the person card, in one call. */
export function monthPerformance(
  person: Person,
  deals: readonly Deal[],
  month: MonthKey,
  asOf: IsoDate,
  policies: readonly CostPolicy[],
  settings: CompanySettings,
): MonthPerformance {
  const holidays = new Set(settings.holidays);
  const pace = paceOfMonth(month, asOf, holidays);
  const window: MonthWindow = { from: month, to: month };
  const c = contribution(person, deals, window, policies);
  const revenueScored = c.revenueScored;
  const totals = c.deals ?? (revenueScored ? ZERO_TOTALS : null);
  const volumeBaisa = totals ? totals.volumeBaisa : null;
  const targetBaisa = revenueScored ? settings.advisorMonthlyTargetBaisa : null;

  const projected = volumeBaisa === null ? null : projection(volumeBaisa, pace);
  return {
    month,
    revenueScored,
    pace,
    volumeBaisa,
    targetBaisa,
    paceIndex:
      volumeBaisa === null || targetBaisa === null ? null : paceIndex(volumeBaisa, targetBaisa, pace),
    projectedVolumeBaisa: projected,
    currentBand: volumeBaisa === null ? null : bandFor(volumeBaisa, settings.bonusBands),
    projectedBand: projected === null ? null : bandFor(projected, settings.bonusBands),
    costBaisa: c.costBaisa,
    contributionBaisa: c.netBaisa,
    deals: totals,
  };
}

export interface LifetimeSummary {
  personId: string;
  tenureMonths: number;
  revenueScored: boolean;
  totalCostBaisa: Baisa;
  totalBroughtInBaisa: Baisa | null;
  netBaisa: Baisa | null;
  lifetimeReturn: number | null;
  paybackMonth: MonthKey | null;
  trend: Trend;
}

/** The "since day one" tab — the number that settles arguments. */
export function lifetimeSummary(
  person: Person,
  deals: readonly Deal[],
  asOf: IsoDate,
  policies: readonly CostPolicy[],
): LifetimeSummary {
  const c = contribution(person, deals, lifetimeWindow(person, asOf), policies);
  return {
    personId: person.id,
    tenureMonths: tenureMonths(person, asOf),
    revenueScored: c.revenueScored,
    totalCostBaisa: c.costBaisa,
    totalBroughtInBaisa: c.broughtInBaisa,
    netBaisa: c.netBaisa,
    lifetimeReturn: c.returnMultiple,
    paybackMonth: paybackMonth(person, deals, asOf, policies),
    trend: trend(person, deals, asOf, policies),
  };
}

/** The Quarter tab: the quarter's window plus its three monthly contributions. */
export function quarterWindow(month: MonthKey): MonthWindow {
  const q = quarterOf(month);
  return { from: q.months[0], to: q.months[q.months.length - 1] };
}
