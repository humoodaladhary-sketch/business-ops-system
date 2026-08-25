// What people cost, month by month, under effective-dated policy.
//
// The cost of August 2026 must never change because something was edited in
// September. That is achieved by resolving the cost policy per month from its
// `effectiveFrom` date, rather than branching on "today".

import { type Baisa, applyPct, roundHalfUp, sumBaisa } from "./baisa";
import {
  type IsoDate,
  type MonthKey,
  compareDates,
  firstDayOfMonth,
  lastDayOfMonth,
  monthOf,
  monthRange,
} from "./calendar";
import type { CostPolicy, MonthWindow, OverheadLine, Person, PayrollClass } from "./types";

export class CostPolicyError extends Error {}

/** Policies sorted oldest-first. */
export function sortPolicies(policies: readonly CostPolicy[]): CostPolicy[] {
  return [...policies].sort((a, b) => compareDates(a.effectiveFrom, b.effectiveFrom));
}

/**
 * The policy in force for a month — the latest one whose `effectiveFrom` falls
 * on or before the month's last day. A policy starting mid-month therefore
 * governs that whole month, which matches how payroll is actually run.
 */
export function policyForMonth(policies: readonly CostPolicy[], month: MonthKey): CostPolicy {
  const end = lastDayOfMonth(month);
  let chosen: CostPolicy | null = null;
  for (const p of sortPolicies(policies)) {
    if (compareDates(p.effectiveFrom, end) <= 0) chosen = p;
  }
  if (!chosen) {
    throw new CostPolicyError(
      `No cost policy in force for ${month}. The earliest policy starts after this month.`,
    );
  }
  return chosen;
}

function applies(rule: { appliesTo: readonly PayrollClass[] } | null, p: Person): boolean {
  return rule !== null && rule.appliesTo.includes(p.payrollClass);
}

function wageForBasis(person: Person, basis: "basic" | "totalWage"): Baisa {
  return basis === "basic" ? person.basicBaisa : person.basicBaisa + person.allowanceBaisa;
}

export interface CostBreakdown {
  basicBaisa: Baisa;
  allowanceBaisa: Baisa;
  socialInsuranceBaisa: Baisa;
  eosAccrualBaisa: Baisa;
  totalBaisa: Baisa;
}

export const ZERO_COST: CostBreakdown = {
  basicBaisa: 0,
  allowanceBaisa: 0,
  socialInsuranceBaisa: 0,
  eosAccrualBaisa: 0,
  totalBaisa: 0,
};

/** Is this person on the payroll in this month? Start and end months count in full. */
export function isEmployedInMonth(person: Person, month: MonthKey): boolean {
  if (month < monthOf(person.measurementStartDate)) return false;
  if (person.endedAt !== null && month > monthOf(person.endedAt)) return false;
  return true;
}

/**
 * What a person costs in a month under a GIVEN policy, ignoring their
 * employment dates. Use this to ask "what would this roster cost under these
 * rules"; use `personMonthlyCost` to ask "what did this month actually cost".
 */
export function personCostUnderPolicy(person: Person, policy: CostPolicy): CostBreakdown {
  let socialInsuranceBaisa = 0;
  if (applies(policy.socialInsurance, person)) {
    const rule = policy.socialInsurance!;
    const wage = wageForBasis(person, rule.basis);
    const capped = Math.min(wage, rule.contributoryWageCapBaisa);
    socialInsuranceBaisa = applyPct(capped, rule.ratePct);
  }

  let eosAccrualBaisa = 0;
  if (applies(policy.endOfService, person)) {
    const rule = policy.endOfService!;
    if (rule.divisor === 0) throw new CostPolicyError(`End-of-service divisor is zero in ${policy.id}`);
    eosAccrualBaisa = roundHalfUp(wageForBasis(person, rule.basis) / rule.divisor);
  }

  return {
    basicBaisa: person.basicBaisa,
    allowanceBaisa: person.allowanceBaisa,
    socialInsuranceBaisa,
    eosAccrualBaisa,
    totalBaisa: person.basicBaisa + person.allowanceBaisa + socialInsuranceBaisa + eosAccrualBaisa,
  };
}

/**
 * One person, one month, under the policy in force for that month.
 * Returns all-zero for a month they were not employed in.
 */
export function personMonthlyCost(
  person: Person,
  month: MonthKey,
  policies: readonly CostPolicy[],
): CostBreakdown {
  if (!isEmployedInMonth(person, month)) return { ...ZERO_COST };
  return personCostUnderPolicy(person, policyForMonth(policies, month));
}

export function addCost(a: CostBreakdown, b: CostBreakdown): CostBreakdown {
  return {
    basicBaisa: a.basicBaisa + b.basicBaisa,
    allowanceBaisa: a.allowanceBaisa + b.allowanceBaisa,
    socialInsuranceBaisa: a.socialInsuranceBaisa + b.socialInsuranceBaisa,
    eosAccrualBaisa: a.eosAccrualBaisa + b.eosAccrualBaisa,
    totalBaisa: a.totalBaisa + b.totalBaisa,
  };
}

export interface PersonCostResult extends CostBreakdown {
  /** Months actually charged — employment clipped to the window. */
  months: number;
  byMonth: { month: MonthKey; cost: CostBreakdown }[];
}

/**
 * `personCost(p, from, to)` — the sum of monthly cost across the window,
 * counting only months the person was employed. Start and end months count in
 * full, which is how the company actually pays.
 */
export function personCost(
  person: Person,
  window: MonthWindow,
  policies: readonly CostPolicy[],
): PersonCostResult {
  const byMonth: { month: MonthKey; cost: CostBreakdown }[] = [];
  let total: CostBreakdown = { ...ZERO_COST };
  let months = 0;
  for (const month of monthRange(window.from, window.to)) {
    if (!isEmployedInMonth(person, month)) continue;
    const cost = personMonthlyCost(person, month, policies);
    byMonth.push({ month, cost });
    total = addCost(total, cost);
    months += 1;
  }
  return { ...total, months, byMonth };
}

/** Everyone on the payroll in this month, and what they cost in it. */
export function monthlyPayroll(
  people: readonly Person[],
  month: MonthKey,
  policies: readonly CostPolicy[],
): { totalBaisa: Baisa; breakdown: CostBreakdown; headcount: number } {
  let breakdown: CostBreakdown = { ...ZERO_COST };
  let headcount = 0;
  for (const person of people) {
    if (!isEmployedInMonth(person, month)) continue;
    breakdown = addCost(breakdown, personMonthlyCost(person, month, policies));
    headcount += 1;
  }
  return { totalBaisa: breakdown.totalBaisa, breakdown, headcount };
}

export interface OverheadTotal {
  pricedBaisa: Baisa;
  /** Cost lines known to exist but not yet priced. Never fold these into zero. */
  unpricedCount: number;
  unpriced: readonly OverheadLine[];
}

export function overheadTotal(policy: CostPolicy): OverheadTotal {
  const unpriced = policy.overheads.filter((o) => o.amountBaisa === null);
  const priced = sumBaisa(
    policy.overheads.filter((o) => o.amountBaisa !== null).map((o) => o.amountBaisa as Baisa),
  );
  return { pricedBaisa: priced, unpricedCount: unpriced.length, unpriced };
}

export interface FixedCost {
  month: MonthKey;
  policyId: string;
  payrollBaisa: Baisa;
  overheadsBaisa: Baisa;
  totalBaisa: Baisa;
  headcount: number;
  /** Cost lines still unpriced. Surface this; a fixed cost with a gap is not final. */
  unpricedCostItems: number;
}

/** Monthly fixed cost = payroll + priced overheads, under the month's policy. */
export function fixedCostForMonth(
  people: readonly Person[],
  month: MonthKey,
  policies: readonly CostPolicy[],
): FixedCost {
  const policy = policyForMonth(policies, month);
  const payroll = monthlyPayroll(people, month, policies);
  const overheads = overheadTotal(policy);
  return {
    month,
    policyId: policy.id,
    payrollBaisa: payroll.totalBaisa,
    overheadsBaisa: overheads.pricedBaisa,
    totalBaisa: payroll.totalBaisa + overheads.pricedBaisa,
    headcount: payroll.headcount,
    unpricedCostItems: overheads.unpricedCount,
  };
}

/**
 * Monthly sale volume required to cover fixed cost, given the rate at which the
 * company keeps volume as net. Null when the keep rate is zero or unknown —
 * there is no volume that breaks even, and a big number would be a lie.
 */
export function breakEvenVolume(fixedCostBaisa: Baisa, companyKeepRate: number | null): Baisa | null {
  if (companyKeepRate === null || companyKeepRate <= 0) return null;
  return roundHalfUp(fixedCostBaisa / companyKeepRate);
}

/**
 * The wage re-basing risk, priced as a scenario and never as a booked cost:
 * what monthly cost becomes if the authorities assess contributions on total
 * wage instead of basic.
 */
export function wageRebasingScenario(
  people: readonly Person[],
  month: MonthKey,
  policies: readonly CostPolicy[],
): { currentBaisa: Baisa; rebasedBaisa: Baisa; monthlyDeltaBaisa: Baisa; annualDeltaBaisa: Baisa } {
  const policy = policyForMonth(policies, month);
  const current = monthlyPayroll(people, month, policies).totalBaisa;
  if (!policy.socialInsurance) {
    return { currentBaisa: current, rebasedBaisa: current, monthlyDeltaBaisa: 0, annualDeltaBaisa: 0 };
  }
  const rebasedPolicy: CostPolicy = {
    ...policy,
    id: `${policy.id}__rebased`,
    effectiveFrom: firstDayOfMonth(month),
    socialInsurance: { ...policy.socialInsurance, basis: "totalWage" },
  };
  const rebased = monthlyPayroll(people, month, [rebasedPolicy]).totalBaisa;
  const delta = rebased - current;
  return {
    currentBaisa: current,
    rebasedBaisa: rebased,
    monthlyDeltaBaisa: delta,
    annualDeltaBaisa: delta * 12,
  };
}

/** Convenience: the policy in force on a given date. */
export function policyForDate(policies: readonly CostPolicy[], date: IsoDate): CostPolicy {
  return policyForMonth(policies, monthOf(date));
}

/**
 * People whose payroll classification is unconfirmed while a statutory policy is
 * in force for the month. Their statutory cost is charged as nil, which is an
 * assumption, not a fact — so it has to be visible. Empty means no gap.
 */
export function payrollClassificationGaps(
  people: readonly Person[],
  month: MonthKey,
  policies: readonly CostPolicy[],
): Person[] {
  const policy = policyForMonth(policies, month);
  const hasStatutoryRules = policy.socialInsurance !== null || policy.endOfService !== null;
  if (!hasStatutoryRules) return [];
  return people.filter((p) => p.payrollClass === "Unclassified" && isEmployedInMonth(p, month));
}

/** People on the books on a given date. */
export function activePeopleOn(people: readonly Person[], asOf: IsoDate): Person[] {
  return people.filter(
    (p) =>
      compareDates(p.measurementStartDate, asOf) <= 0 &&
      (p.endedAt === null || compareDates(p.endedAt, asOf) >= 0),
  );
}

export interface RunRateFixedCost extends FixedCost {
  /** Headcount on the books at `asOf` — not the number of people ever seeded. */
  activeHeadcount: number;
}

/**
 * Forward-looking fixed cost: what the roster active TODAY costs in a month
 * governed by `policyMonth`'s rules.
 *
 * This is deliberately different from `fixedCostForMonth`, which is the
 * historical actual and includes people who have since left. Break-even is a
 * question about the months ahead, so it uses this: the ten people currently on
 * the books, not the twelve who appear in the 2026 record. Reporting the
 * historical figure as break-even would overstate the volume the company needs.
 */
export function runRateFixedCost(
  people: readonly Person[],
  asOf: IsoDate,
  policyMonth: MonthKey,
  policies: readonly CostPolicy[],
): RunRateFixedCost {
  const policy = policyForMonth(policies, policyMonth);
  const active = activePeopleOn(people, asOf);
  let payrollBaisa = 0;
  for (const person of active) payrollBaisa += personCostUnderPolicy(person, policy).totalBaisa;
  const overheads = overheadTotal(policy);
  return {
    month: policyMonth,
    policyId: policy.id,
    payrollBaisa,
    overheadsBaisa: overheads.pricedBaisa,
    totalBaisa: payrollBaisa + overheads.pricedBaisa,
    headcount: active.length,
    activeHeadcount: active.length,
    unpricedCostItems: overheads.unpricedCount,
  };
}
