// Company-level truth: where the month stands, where it lands, what it costs.
//
// The founder's pay is a real cash cost and belongs in payroll, fixed cost and
// break-even — the company genuinely pays it. It is separated only where the
// question is "how are the advisors doing", never where the question is
// "what does this company cost to run".

import { type Baisa, ratio } from "./baisa";
import { type IsoDate, type MonthKey, type Pace, monthOf, monthRange, paceOfMonth } from "./calendar";
import { type FixedCost, breakEvenVolume, fixedCostForMonth, isEmployedInMonth, personCost } from "./cost";
import {
  type DealTotals,
  companyKeepRate,
  dealsInWindow,
  effectiveCommissionRate,
  openReferralLiabilities,
  totalsOf,
} from "./deals";
import { bandFor, isRevenueScored, paceIndex, projection } from "./person";
import type { CeoDataset, CompanySettings, CostPolicy, Deal, MonthWindow, Person, Provision } from "./types";

export interface CompanyWindowSummary {
  window: MonthWindow;
  deals: DealTotals;
  /** Total people cost across the window, including the owner distribution. */
  totalCostBaisa: Baisa;
  /** People cost excluding the owner distribution — the operating cost of the team. */
  operatingCostBaisa: Baisa;
  ownerDistributionBaisa: Baisa;
  netBaisa: Baisa;
  returnMultiple: number | null;
  effectiveCommissionRate: number | null;
  companyKeepRate: number | null;
  headcountAtEnd: number;
}

/**
 * The company across a window. Departed people are included for the months they
 * were employed — their cost and their revenue both stay in the record. Dropping
 * them would overstate company performance.
 */
export function companySummary(
  people: readonly Person[],
  deals: readonly Deal[],
  window: MonthWindow,
  policies: readonly CostPolicy[],
): CompanyWindowSummary {
  const windowDeals = dealsInWindow(deals, window);
  const totals = totalsOf(windowDeals);

  let totalCostBaisa = 0;
  let ownerDistributionBaisa = 0;
  for (const person of people) {
    const cost = personCost(person, window, policies).totalBaisa;
    totalCostBaisa += cost;
    if (person.costTreatment === "ownerDistribution") ownerDistributionBaisa += cost;
  }

  return {
    window,
    deals: totals,
    totalCostBaisa,
    operatingCostBaisa: totalCostBaisa - ownerDistributionBaisa,
    ownerDistributionBaisa,
    netBaisa: totals.companyNetBaisa - totalCostBaisa,
    returnMultiple: ratio(totals.companyNetBaisa, totalCostBaisa),
    effectiveCommissionRate: effectiveCommissionRate(windowDeals),
    companyKeepRate: companyKeepRate(windowDeals),
    headcountAtEnd: people.filter((p) => isEmployedInMonth(p, window.to)).length,
  };
}

export interface CompanyMonthState {
  month: MonthKey;
  pace: Pace;
  volumeBaisa: Baisa;
  broughtInBaisa: Baisa;
  fixedCost: FixedCost;
  /** Monthly volume needed to cover fixed cost, at the keep rate supplied. */
  breakEvenVolumeBaisa: Baisa | null;
  /** Where the month lands at this rate. Null before pace is measurable. */
  projectedVolumeBaisa: Baisa | null;
  projectedBroughtInBaisa: Baisa | null;
  /** Projected volume ÷ break-even volume. Above 1.0 the month covers itself. */
  projectedBreakEvenCoverage: number | null;
  paceIndexVsBreakEven: number | null;
  unpricedCostItems: number;
}

/**
 * Where the month stands and where it will land. The keep rate is passed in
 * rather than derived from the month alone — a single early deal in a month
 * would otherwise set a keep rate the rest of the month gets judged against.
 */
export function companyMonthState(
  people: readonly Person[],
  deals: readonly Deal[],
  month: MonthKey,
  asOf: IsoDate,
  policies: readonly CostPolicy[],
  settings: CompanySettings,
  keepRate: number | null,
): CompanyMonthState {
  const pace = paceOfMonth(month, asOf, new Set(settings.holidays));
  const totals = totalsOf(dealsInWindow(deals, { from: month, to: month }));
  const fixedCost = fixedCostForMonth(people, month, policies);
  const breakEven = breakEvenVolume(fixedCost.totalBaisa, keepRate);
  const projectedVolume = projection(totals.volumeBaisa, pace);
  return {
    month,
    pace,
    volumeBaisa: totals.volumeBaisa,
    broughtInBaisa: totals.companyNetBaisa,
    fixedCost,
    breakEvenVolumeBaisa: breakEven,
    projectedVolumeBaisa: projectedVolume,
    projectedBroughtInBaisa: projection(totals.companyNetBaisa, pace),
    projectedBreakEvenCoverage:
      projectedVolume === null || breakEven === null || breakEven === 0
        ? null
        : projectedVolume / breakEven,
    paceIndexVsBreakEven: breakEven === null ? null : paceIndex(totals.volumeBaisa, breakEven, pace),
    unpricedCostItems: fixedCost.unpricedCostItems,
  };
}

export interface PersonStanding {
  person: Person;
  costBaisa: Baisa;
  broughtInBaisa: Baisa | null;
  netBaisa: Baisa | null;
  returnMultiple: number | null;
  revenueScored: boolean;
}

/**
 * Every person's standing across a window, revenue-scored people ranked by
 * return. The founder is returned but flagged `ranked: false` by the caller's
 * use of `isRankedAgainstAdvisors` — he is never in the same league table.
 */
export function standings(
  people: readonly Person[],
  deals: readonly Deal[],
  window: MonthWindow,
  policies: readonly CostPolicy[],
): PersonStanding[] {
  const rows: PersonStanding[] = people.map((person) => {
    const cost = personCost(person, window, policies).totalBaisa;
    const revenueScored = isRevenueScored(person.personClass);
    const own = revenueScored
      ? totalsOf(dealsInWindow(deals.filter((d) => d.advisorId === person.id), window))
      : null;
    const broughtInBaisa = own ? own.companyNetBaisa : null;
    return {
      person,
      costBaisa: cost,
      broughtInBaisa,
      netBaisa: broughtInBaisa === null ? null : broughtInBaisa - cost,
      returnMultiple: broughtInBaisa === null ? null : ratio(broughtInBaisa, cost),
      revenueScored,
    };
  });
  return rows.sort((a, b) => (b.returnMultiple ?? -Infinity) - (a.returnMultiple ?? -Infinity));
}

export interface DerivedRates {
  effectiveCommissionRate: number | null;
  companyKeepRate: number | null;
  /** Break-even monthly volume per month across the window, as policy changes. */
  breakEvenByMonth: { month: MonthKey; fixedCostBaisa: Baisa; breakEvenVolumeBaisa: Baisa | null }[];
  openReferralLiabilities: { payee: string; amountBaisa: Baisa; dealRefs: string[] }[];
}

/**
 * The rates the whole system leans on, derived from the book rather than
 * hardcoded. Running this from September onward produces higher break-even
 * automatically, because the cost policy changed — not because a constant did.
 */
export function derivedRates(
  people: readonly Person[],
  deals: readonly Deal[],
  window: MonthWindow,
  policies: readonly CostPolicy[],
): DerivedRates {
  const windowDeals = dealsInWindow(deals, window);
  const keepRate = companyKeepRate(windowDeals);
  return {
    effectiveCommissionRate: effectiveCommissionRate(windowDeals),
    companyKeepRate: keepRate,
    breakEvenByMonth: monthRange(window.from, window.to).map((month) => {
      const fc = fixedCostForMonth(people, month, policies);
      return {
        month,
        fixedCostBaisa: fc.totalBaisa,
        breakEvenVolumeBaisa: breakEvenVolume(fc.totalBaisa, keepRate),
      };
    }),
    openReferralLiabilities: openReferralLiabilities(windowDeals),
  };
}

/** Provisions the system surfaces but does not calculate. */
export function openProvisions(provisions: readonly Provision[]): Provision[] {
  return provisions.filter((p) => p.status === "open");
}

/** Convenience wrapper over a whole dataset for the company view. */
export function companyAsOf(dataset: CeoDataset, asOf: IsoDate, from?: MonthKey) {
  const window: MonthWindow = {
    from: from ?? earliestMeasurementMonth(dataset.people),
    to: monthOf(asOf),
  };
  const rates = derivedRates(dataset.people, dataset.deals, window, dataset.costPolicies);
  return {
    window,
    summary: companySummary(dataset.people, dataset.deals, window, dataset.costPolicies),
    rates,
    month: companyMonthState(
      dataset.people,
      dataset.deals,
      monthOf(asOf),
      asOf,
      dataset.costPolicies,
      dataset.settings,
      rates.companyKeepRate,
    ),
    standings: standings(dataset.people, dataset.deals, window, dataset.costPolicies),
    provisions: openProvisions(dataset.provisions),
  };
}

export function earliestMeasurementMonth(people: readonly Person[]): MonthKey {
  const months = people.map((p) => monthOf(p.measurementStartDate)).sort();
  if (months.length === 0) throw new Error("No people — cannot determine a measurement baseline.");
  return months[0];
}

export { bandFor };
