// CEO Command Center copilot tools.
//
// Every one of these reads the current dataset and recomputes through
// `@/lib/calc` — the same functions the tests pin against the CEO's verified
// table. Nothing here reimplements a formula, and nothing is cached in a prompt,
// so what the copilot says is what the maths says, at the moment it is asked.
//
// These tools do not touch the database, so they carry `needsDb: false` and the
// copilot's tool-loop runs for them even where no Supabase client is configured.

import {
  agentCutAnomalies,
  awaitingCollection,
  awaitingInvoice,
  baisaToOmr,
  bandFor,
  companyMonthState,
  companySummary,
  companyKeepRate,
  contribution,
  derivedRates,
  dealsForPerson,
  dealsInWindow,
  effectiveCommissionRate,
  isBonusEligible,
  isRevenueScored,
  lifetimeSummary,
  monthOf,
  monthPerformance,
  monthlyLedger,
  monthlyPayroll,
  openProvisions,
  openReferralLiabilities,
  payrollClassificationGaps,
  personCost,
  policyForMonth,
  quarterWindow,
  runRateFixedCost,
  standings,
  totalsByMonth,
  totalsOf,
  tenureMonths,
  trend,
  wageRebasingScenario,
  type CeoDataset,
  type Deal,
  type MonthWindow,
  type Person,
} from "@/lib/calc";
import { loadCeoDataset, todayInMuscat } from "@/lib/ceoData";
import type { CopilotTool, ToolInput } from "./config";

// --- shaping helpers --------------------------------------------------------

/** Baisa to OMR, rounded to the baisa. All money out of these tools is OMR. */
const omr = (baisa: number): number => Number(baisaToOmr(baisa).toFixed(3));
const omrOrNull = (baisa: number | null): number | null => (baisa === null ? null : omr(baisa));
const pct = (fraction: number | null, dp = 4): number | null =>
  fraction === null ? null : Number((fraction * 100).toFixed(dp));
const round = (n: number | null, dp = 2): number | null =>
  n === null ? null : Number(n.toFixed(dp));
/**
 * Break-even is a volume target, always reported to the whole OMR. Every tool
 * uses this so the copilot can never quote two different numbers for it.
 */
const breakEvenOmr = (baisa: number | null): number | null =>
  baisa === null ? null : Math.round(baisaToOmr(baisa));

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

function asOfFrom(input: ToolInput): string {
  return str(input.as_of) ?? todayInMuscat();
}

function datasetOr(input: ToolInput): { ds: CeoDataset; asOf: string } {
  return { ds: loadCeoDataset(), asOf: asOfFrom(input) };
}

/** Window from explicit months, else the whole measured record to `asOf`. */
function windowFrom(input: ToolInput, ds: CeoDataset, asOf: string): MonthWindow {
  const from = str(input.from_month) ?? ds.people.map((p) => monthOf(p.measurementStartDate)).sort()[0];
  const to = str(input.to_month) ?? monthOf(asOf);
  return { from, to };
}

function findPerson(ds: CeoDataset, needle: string): Person | null {
  const q = needle.trim().toLowerCase();
  return (
    ds.people.find((p) => p.id.toLowerCase() === q) ??
    ds.people.find((p) => p.name.en.toLowerCase() === q || p.name.ar === needle.trim()) ??
    ds.people.find((p) => p.name.en.toLowerCase().includes(q) || p.name.ar.includes(needle.trim())) ??
    null
  );
}

function personNotFound(ds: CeoDataset, needle: string) {
  return {
    error: `No person matching ${JSON.stringify(needle)}.`,
    known_people: ds.people.map((p) => ({ id: p.id, name: p.name.en, role: p.role.en })),
  };
}

function personHeader(person: Person, asOf: string) {
  return {
    id: person.id,
    name: person.name.en,
    name_ar: person.name.ar,
    role: person.role.en,
    role_ar: person.role.ar,
    person_class: person.personClass,
    revenue_scored: isRevenueScored(person.personClass),
    bonus_eligible: isBonusEligible(person),
    cost_treatment: person.costTreatment,
    measurement_start: person.measurementStartDate,
    ended_at: person.endedAt,
    active: person.endedAt === null || person.endedAt >= asOf,
    tenure_months: tenureMonths(person, asOf),
    monthly_basic_omr: omr(person.basicBaisa),
    monthly_allowance_omr: omr(person.allowanceBaisa),
    default_commission_cut_pct: person.commissionCutPct,
  };
}

function dealOut(d: Deal) {
  return {
    ref: d.ref,
    month: d.month,
    advisor_id: d.advisorId,
    developer: d.developer,
    project: d.project,
    unit_type: d.unitType,
    unit_value_omr: omr(d.unitValueBaisa),
    commission_pct: d.commissionPct,
    gross_commission_omr: omr(d.grossCommissionBaisa),
    incentive_omr: omr(d.incentiveBaisa),
    referral_payee: d.referralPayee,
    referral_omr: omr(d.referralBaisa),
    agent_cut_pct: d.agentCutPct,
    agent_amount_omr: omr(d.agentAmountBaisa),
    company_net_omr: omr(
      d.grossCommissionBaisa - d.referralBaisa - d.agentAmountBaisa + d.incentiveBaisa,
    ),
    stage: d.stage,
    invoiced: d.invoiced,
    collected: d.collected,
  };
}

function totalsOut(t: ReturnType<typeof totalsOf>) {
  return {
    deals: t.count,
    volume_omr: omr(t.volumeBaisa),
    gross_commission_omr: omr(t.grossCommissionBaisa),
    referrals_omr: omr(t.referralBaisa),
    advisor_cuts_omr: omr(t.agentShareBaisa),
    incentives_omr: omr(t.incentiveBaisa),
    company_net_omr: omr(t.companyNetBaisa),
  };
}

function paceOut(p: { elapsed: number; total: number; fraction: number; measurable: boolean }) {
  return {
    working_days_elapsed: p.elapsed,
    working_days_total: p.total,
    fraction: round(p.fraction, 4),
    measurable: p.measurable,
    note: p.measurable ? undefined : "Not yet measurable — fewer than 3 working days elapsed.",
  };
}

const AS_OF_PROP = {
  as_of: {
    type: "string",
    description: "Measure as of this date (YYYY-MM-DD). Defaults to today in Asia/Muscat.",
  },
} as const;

const WINDOW_PROPS = {
  from_month: { type: "string", description: "First month, YYYY-MM. Defaults to the start of the record." },
  to_month: { type: "string", description: "Last month, YYYY-MM. Defaults to the month of as_of." },
  ...AS_OF_PROP,
} as const;

// --- tools ------------------------------------------------------------------

const companyPosition: CopilotTool = {
  name: "company_position",
  description:
    "Where the company stands: deals, volume, what was brought in, total people cost, net, return multiple, " +
    "the derived commission and keep rates, the current month's pace and projection, break-even, and any open " +
    "provisions. Start here for 'how are we doing', 'where do we stand', 'are we profitable'.",
  needsDb: false,
  input_schema: { type: "object", properties: { ...WINDOW_PROPS } },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const window = windowFrom(input, ds, asOf);
    const summary = companySummary(ds.people, ds.deals, window, ds.costPolicies);
    const rates = derivedRates(ds.people, ds.deals, window, ds.costPolicies);
    const month = companyMonthState(
      ds.people, ds.deals, monthOf(asOf), asOf, ds.costPolicies, ds.settings, rates.companyKeepRate,
    );
    return {
      as_of: asOf,
      window,
      currency: "OMR",
      totals: totalsOut(summary.deals),
      cost: {
        total_people_cost_omr: omr(summary.totalCostBaisa),
        operating_cost_omr: omr(summary.operatingCostBaisa),
        owner_distribution_omr: omr(summary.ownerDistributionBaisa),
        note: "The founder's pay is an owner distribution. It is a real cash cost and stays in company cost and break-even, but he is never ranked against the advisors.",
      },
      net_omr: omr(summary.netBaisa),
      return_multiple: round(summary.returnMultiple, 2),
      headcount_at_end: summary.headcountAtEnd,
      derived_rates: {
        effective_commission_rate_pct: pct(rates.effectiveCommissionRate),
        company_keep_rate_pct: pct(rates.companyKeepRate),
        note: "Derived from the deal book, not hardcoded.",
      },
      current_month: {
        month: month.month,
        pace: paceOut(month.pace),
        volume_omr: omr(month.volumeBaisa),
        brought_in_omr: omr(month.broughtInBaisa),
        projected_volume_omr: omrOrNull(month.projectedVolumeBaisa),
        break_even_volume_omr: breakEvenOmr(month.breakEvenVolumeBaisa),
        projected_break_even_coverage: round(month.projectedBreakEvenCoverage, 3),
        fixed_cost_omr: omr(month.fixedCost.totalBaisa),
        unpriced_cost_items: month.unpricedCostItems,
      },
      open_provisions: openProvisions(ds.provisions).map((p) => ({
        id: p.id,
        label: p.label.en,
        amount_omr: omrOrNull(p.amountBaisa),
        flag: p.flag.en,
      })),
      data_gaps: {
        unpriced_cost_items: month.unpricedCostItems,
        note: month.unpricedCostItems > 0
          ? `${month.unpricedCostItems} cost items are known but not yet priced — fixed cost and break-even are therefore understated.`
          : undefined,
      },
    };
  },
};

const personReport: CopilotTool = {
  name: "person_report",
  description:
    "Everything about one person across all four time windows — today, this month, this quarter, and since day " +
    "one: what they cost, what they brought in, their net, lifetime return, payback month, and their direction " +
    "(improving or declining). Only returns metrics the person's role owns: support staff have no revenue " +
    "metrics at all, which is not the same as zero. Use for 'how is X doing', 'is X worth it', 'has X paid back'.",
  needsDb: false,
  input_schema: {
    type: "object",
    properties: {
      person: { type: "string", description: "Person id, English name, or Arabic name." },
      ...AS_OF_PROP,
    },
    required: ["person"],
  },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const needle = str(input.person);
    if (!needle) return { error: "person is required" };
    const person = findPerson(ds, needle);
    if (!person) return personNotFound(ds, needle);

    const month = monthOf(asOf);
    const monthCard = monthPerformance(person, ds.deals, month, asOf, ds.costPolicies, ds.settings);
    const quarter = quarterWindow(month);
    const quarterContribution = contribution(person, ds.deals, quarter, ds.costPolicies);
    const lifetime = lifetimeSummary(person, ds.deals, asOf, ds.costPolicies);
    const scored = isRevenueScored(person.personClass);
    const todayDeals = scored ? dealsForPerson(ds.deals, person.id).filter((d) => d.month === month) : [];

    return {
      as_of: asOf,
      person: personHeader(person, asOf),
      today: {
        note: "The deal record is monthly, so 'today' shows this month's deals. Empty is a legitimate answer for most people on most days.",
        deals_this_month: scored ? todayDeals.map(dealOut) : null,
      },
      month: {
        month,
        pace: paceOut(monthCard.pace),
        volume_omr: omrOrNull(monthCard.volumeBaisa),
        target_omr: omrOrNull(monthCard.targetBaisa),
        pace_index: round(monthCard.paceIndex, 3),
        projected_volume_omr: omrOrNull(monthCard.projectedVolumeBaisa),
        current_bonus_band: monthCard.currentBand
          ? { id: monthCard.currentBand.id, label: monthCard.currentBand.label.en, bonus_omr: omr(monthCard.currentBand.bonusBaisa) }
          : null,
        projected_bonus_band: monthCard.projectedBand
          ? { id: monthCard.projectedBand.id, label: monthCard.projectedBand.label.en, bonus_omr: omr(monthCard.projectedBand.bonusBaisa) }
          : null,
        cost_omr: omr(monthCard.costBaisa),
        contribution_omr: omrOrNull(monthCard.contributionBaisa),
        deals: monthCard.deals ? totalsOut(monthCard.deals) : null,
      },
      quarter: {
        window: quarter,
        cost_omr: omr(quarterContribution.costBaisa),
        brought_in_omr: omrOrNull(quarterContribution.broughtInBaisa),
        net_omr: omrOrNull(quarterContribution.netBaisa),
        return_multiple: round(quarterContribution.returnMultiple, 2),
        by_month: monthlyLedger(person, ds.deals, quarter, ds.costPolicies).map((r) => ({
          month: r.month,
          cost_omr: omr(r.costBaisa),
          brought_in_omr: omr(r.broughtInBaisa),
          contribution_omr: omr(r.broughtInBaisa - r.costBaisa),
        })),
      },
      since_day_one: {
        tenure_months: lifetime.tenureMonths,
        total_cost_omr: omr(lifetime.totalCostBaisa),
        total_brought_in_omr: omrOrNull(lifetime.totalBroughtInBaisa),
        net_omr: omrOrNull(lifetime.netBaisa),
        lifetime_return: round(lifetime.lifetimeReturn, 2),
        payback_month: lifetime.paybackMonth,
        payback_note: lifetime.revenueScored
          ? lifetime.paybackMonth ?? "not yet"
          : "Not revenue-scored — this person is measured on their own KPIs, never on contribution.",
        direction: lifetime.trend.direction,
        direction_note:
          "Direction compares the last three months against this person's own lifetime average. Two people at the same multiple heading opposite ways are two different decisions.",
        recent_monthly_avg_omr: omrOrNull(lifetime.trend.recentMonthlyAvgBaisa),
        lifetime_monthly_avg_omr: omrOrNull(lifetime.trend.lifetimeMonthlyAvgBaisa),
      },
    };
  },
};

const peopleStandings: CopilotTool = {
  name: "people_standings",
  description:
    "Every person's cost, what they brought in, net and return over a window, with advisors ranked. The founder " +
    "and support staff are returned separately and never ranked against advisors. Use for 'who is my best " +
    "advisor', 'rank the team', 'who is costing me money', 'what does everyone cost'.",
  needsDb: false,
  input_schema: { type: "object", properties: { ...WINDOW_PROPS } },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const window = windowFrom(input, ds, asOf);
    const rows = standings(ds.people, ds.deals, window, ds.costPolicies);
    const shape = (s: (typeof rows)[number]) => ({
      id: s.person.id,
      name: s.person.name.en,
      role: s.person.role.en,
      active: s.person.endedAt === null || s.person.endedAt >= asOf,
      ended_at: s.person.endedAt,
      cost_omr: omr(s.costBaisa),
      brought_in_omr: omrOrNull(s.broughtInBaisa),
      net_omr: omrOrNull(s.netBaisa),
      return_multiple: round(s.returnMultiple, 2),
      direction: isRevenueScored(s.person.personClass)
        ? trend(s.person, ds.deals, asOf, ds.costPolicies).direction
        : "not-measurable",
    });
    return {
      as_of: asOf,
      window,
      currency: "OMR",
      advisors_ranked: rows.filter((s) => s.person.personClass === "Advisor").map(shape),
      owner: rows.filter((s) => s.person.personClass === "Owner").map(shape),
      kpi_scored_staff: rows.filter((s) => !isRevenueScored(s.person.personClass)).map(shape),
      note: "Support staff show cost but no revenue metrics — they are scored on their own KPIs. A null brought_in is not a zero.",
    };
  },
};

const monthDetail: CopilotTool = {
  name: "month_detail",
  description:
    "One month in full: working-day pace, volume, what was brought in, the projection, fixed cost and break-even, " +
    "which cost policy was in force, and every person's contribution that month. Use for 'how was August', " +
    "'where will this month land', 'did we cover our costs'.",
  needsDb: false,
  input_schema: {
    type: "object",
    properties: {
      month: { type: "string", description: "Month as YYYY-MM. Defaults to the month of as_of." },
      ...AS_OF_PROP,
    },
  },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const month = str(input.month) ?? monthOf(asOf);
    const keepRate = companyKeepRate(ds.deals);
    const state = companyMonthState(ds.people, ds.deals, month, asOf, ds.costPolicies, ds.settings, keepRate);
    const policy = policyForMonth(ds.costPolicies, month);
    const window: MonthWindow = { from: month, to: month };
    return {
      as_of: asOf,
      month,
      pace: paceOut(state.pace),
      totals: totalsOut(totalsOf(dealsInWindow(ds.deals, window))),
      projection: {
        projected_volume_omr: omrOrNull(state.projectedVolumeBaisa),
        projected_brought_in_omr: omrOrNull(state.projectedBroughtInBaisa),
        break_even_volume_omr: breakEvenOmr(state.breakEvenVolumeBaisa),
        projected_break_even_coverage: round(state.projectedBreakEvenCoverage, 3),
        covers_itself: state.projectedBreakEvenCoverage === null ? null : state.projectedBreakEvenCoverage >= 1,
      },
      cost: {
        policy_in_force: { id: policy.id, label: policy.label.en, effective_from: policy.effectiveFrom },
        payroll_omr: omr(state.fixedCost.payrollBaisa),
        overheads_omr: omr(state.fixedCost.overheadsBaisa),
        fixed_cost_omr: omr(state.fixedCost.totalBaisa),
        headcount: state.fixedCost.headcount,
        unpriced_cost_items: state.unpricedCostItems,
      },
      people: ds.people
        .map((p) => ({ p, c: contribution(p, ds.deals, window, ds.costPolicies) }))
        .filter((x) => x.c.months > 0)
        .map((x) => ({
          id: x.p.id,
          name: x.p.name.en,
          cost_omr: omr(x.c.costBaisa),
          brought_in_omr: omrOrNull(x.c.broughtInBaisa),
          contribution_omr: omrOrNull(x.c.netBaisa),
          deals: x.c.deals?.count ?? null,
        })),
      deals: dealsInWindow(ds.deals, window).map(dealOut),
    };
  },
};

const costAndBreakEven: CopilotTool = {
  name: "cost_and_break_even",
  description:
    "What the company costs to run and the monthly volume it must sell to cover it, under any month's cost " +
    "policy. Distinguishes the historical cost of a past month from the forward run rate of today's roster. " +
    "Use for 'what do I spend', 'what is break-even', 'what changes in September', 'what does registering staff cost me'.",
  needsDb: false,
  input_schema: {
    type: "object",
    properties: {
      policy_month: { type: "string", description: "Cost rules to apply, YYYY-MM. Defaults to the month of as_of." },
      compare_month: { type: "string", description: "Optional second month to compare against, YYYY-MM." },
      ...AS_OF_PROP,
    },
  },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const keepRate = companyKeepRate(ds.deals);
    const view = (month: string) => {
      const runRate = runRateFixedCost(ds.people, asOf, month, ds.costPolicies);
      const policy = policyForMonth(ds.costPolicies, month);
      const payroll = monthlyPayroll(ds.people, month, ds.costPolicies);
      const breakEven = keepRate === null || keepRate <= 0 ? null : runRate.totalBaisa / keepRate;
      return {
        policy_month: month,
        policy: {
          id: policy.id,
          label: policy.label.en,
          effective_from: policy.effectiveFrom,
          note: policy.note?.en,
          social_insurance: policy.socialInsurance
            ? { rate_pct: policy.socialInsurance.ratePct, basis: policy.socialInsurance.basis, applies_to: policy.socialInsurance.appliesTo, contributory_wage_cap_omr: omr(policy.socialInsurance.contributoryWageCapBaisa) }
            : null,
          end_of_service: policy.endOfService
            ? { divisor: policy.endOfService.divisor, basis: policy.endOfService.basis, applies_to: policy.endOfService.appliesTo }
            : null,
        },
        run_rate: {
          active_headcount: runRate.activeHeadcount,
          payroll_omr: omr(runRate.payrollBaisa),
          overheads_omr: omr(runRate.overheadsBaisa),
          fixed_cost_omr: omr(runRate.totalBaisa),
          break_even_volume_omr: breakEvenOmr(breakEven === null ? null : Math.round(breakEven)),
          note: "Forward-looking: today's roster under this month's rules. Not the same as what a past month actually cost.",
        },
        historical_that_month: {
          payroll_omr: omr(payroll.totalBaisa),
          headcount: payroll.headcount,
          social_insurance_omr: omr(payroll.breakdown.socialInsuranceBaisa),
          end_of_service_omr: omr(payroll.breakdown.eosAccrualBaisa),
          note: "What that month actually cost, including anyone who has since left.",
        },
        unpriced_cost_items: runRate.unpricedCostItems,
      };
    };
    const primary = view(str(input.policy_month) ?? monthOf(asOf));
    const compare = str(input.compare_month) ? view(str(input.compare_month)!) : null;
    return {
      as_of: asOf,
      currency: "OMR",
      company_keep_rate_pct: pct(keepRate),
      primary,
      compare,
      difference: compare
        ? {
            payroll_omr: round(compare.run_rate.payroll_omr - primary.run_rate.payroll_omr, 3),
            fixed_cost_omr: round(compare.run_rate.fixed_cost_omr - primary.run_rate.fixed_cost_omr, 3),
            break_even_volume_omr:
              compare.run_rate.break_even_volume_omr !== null && primary.run_rate.break_even_volume_omr !== null
                ? compare.run_rate.break_even_volume_omr - primary.run_rate.break_even_volume_omr
                : null,
          }
        : null,
    };
  },
};

const listDeals: CopilotTool = {
  name: "list_deals",
  description:
    "The deal record itself, filtered by person, month range, developer, project or invoicing state. Use when " +
    "asked about specific deals, a developer's contribution, or to check a figure against the underlying rows.",
  needsDb: false,
  input_schema: {
    type: "object",
    properties: {
      person: { type: "string", description: "Advisor id or name." },
      developer: { type: "string", description: "Developer name, partial match." },
      project: { type: "string", description: "Project name, partial match." },
      invoiced: { type: "string", enum: ["yes", "no", "unknown"] },
      collected: { type: "string", enum: ["yes", "no", "unknown"] },
      limit: { type: "number", description: "Max rows, default 50." },
      ...WINDOW_PROPS,
    },
  },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const window = windowFrom(input, ds, asOf);
    let rows = dealsInWindow(ds.deals, window);

    const personNeedle = str(input.person);
    if (personNeedle) {
      const person = findPerson(ds, personNeedle);
      if (!person) return personNotFound(ds, personNeedle);
      rows = rows.filter((d) => d.advisorId === person.id);
    }
    const dev = str(input.developer)?.toLowerCase();
    if (dev) rows = rows.filter((d) => d.developer.toLowerCase().includes(dev));
    const proj = str(input.project)?.toLowerCase();
    if (proj) rows = rows.filter((d) => d.project.toLowerCase().includes(proj));
    if (str(input.invoiced)) rows = rows.filter((d) => d.invoiced === input.invoiced);
    if (str(input.collected)) rows = rows.filter((d) => d.collected === input.collected);

    const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);
    return {
      as_of: asOf,
      window,
      matched: rows.length,
      shown: Math.min(rows.length, limit),
      totals_of_all_matched: totalsOut(totalsOf(rows)),
      deals: rows.slice(0, limit).map(dealOut),
    };
  },
};

const cashGap: CopilotTool = {
  name: "cash_gap",
  description:
    "Money earned but not yet in the bank: deals awaiting an invoice, invoices awaiting payment, and referral " +
    "amounts owed out. Use for 'what am I owed', 'what needs invoicing', 'who do I owe', 'where is my cash'.",
  needsDb: false,
  input_schema: { type: "object", properties: { ...AS_OF_PROP } },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const toInvoice = awaitingInvoice(ds.deals);
    const toCollect = awaitingCollection(ds.deals);
    const referrals = openReferralLiabilities(ds.deals);
    const netOf = (list: Deal[]) => omr(totalsOf(list).companyNetBaisa);
    return {
      as_of: asOf,
      currency: "OMR",
      awaiting_invoice: {
        count: toInvoice.length,
        company_net_omr: netOf(toInvoice),
        deals: toInvoice.map(dealOut),
        note: "Closed, not yet invoiced. Deals already collected are excluded even where the invoice state was never recorded.",
      },
      awaiting_collection: {
        count: toCollect.length,
        company_net_omr: netOf(toCollect),
        deals: toCollect.map(dealOut),
      },
      referral_liabilities_owed_out: {
        total_omr: omr(referrals.reduce((s, r) => s + r.amountBaisa, 0)),
        payees: referrals.map((r) => ({ payee: r.payee, amount_omr: omr(r.amountBaisa), deal_refs: r.dealRefs })),
      },
    };
  },
};

const dataQuality: CopilotTool = {
  name: "data_quality",
  description:
    "What the system knows it does not know, and what looks wrong in the record: unpriced cost items, open " +
    "provisions with no amount, unconfirmed payroll classifications, and deals whose recorded advisor cut does " +
    "not match their own stated percentage. Use before trusting a figure, or for 'what is missing', 'what should I check'.",
  needsDb: false,
  input_schema: { type: "object", properties: { ...AS_OF_PROP } },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const month = monthOf(asOf);
    const policy = policyForMonth(ds.costPolicies, month);
    const anomalies = agentCutAnomalies(ds.deals);
    const netDrift = ds.deals.reduce(
      (s, d) => s + (d.grossCommissionBaisa - d.referralBaisa - d.agentAmountBaisa + d.incentiveBaisa) - d.recordedCompanyNetBaisa,
      0,
    );
    return {
      as_of: asOf,
      unpriced_cost_items: {
        count: policy.overheads.filter((o) => o.amountBaisa === null).length,
        items: policy.overheads.filter((o) => o.amountBaisa === null).map((o) => o.label.en),
        effect: "Fixed cost and break-even are understated until these are priced. They are shown as a gap, never as zero.",
      },
      open_provisions: openProvisions(ds.provisions).map((p) => ({
        label: p.label.en,
        amount_omr: omrOrNull(p.amountBaisa),
        flag: p.flag.en,
      })),
      unconfirmed_payroll_classification: payrollClassificationGaps(ds.people, month, ds.costPolicies).map((p) => ({
        id: p.id,
        name: p.name.en,
        effect: "Carries no statutory cost while unconfirmed — an assumption, not a fact.",
      })),
      advisor_cut_anomalies: {
        count: anomalies.length,
        total_difference_omr: omr(anomalies.reduce((s, a) => s + a.differenceBaisa, 0)),
        note: "Recorded amounts are what was actually paid and what every published figure is built from. This is a report, not a correction.",
        rows: anomalies.map((a) => ({
          ref: a.deal.ref,
          advisor_id: a.deal.advisorId,
          stated_cut_pct: a.deal.agentCutPct,
          recorded_omr: omr(a.recordedBaisa),
          expected_omr: omr(a.expectedBaisa),
          difference_omr: omr(a.differenceBaisa),
        })),
      },
      source_sheet_net_drift_baisa: netDrift,
      source_sheet_note:
        "The source sheet's own net column drifts from its components by a couple of baisa because it was computed in floating point. Every figure here is recomputed from components in integer baisa.",
    };
  },
};

const settingsAndScenarios: CopilotTool = {
  name: "settings_and_scenarios",
  description:
    "The numbers the system runs on — advisor target, band width, bonus bands, cost policies and their effective " +
    "dates, holidays — plus the wage re-basing risk priced as a scenario rather than a booked cost. Use for " +
    "'what is the target', 'what are the bonus bands', 'what if contributions are re-based on total wage'.",
  needsDb: false,
  input_schema: {
    type: "object",
    properties: {
      scenario_month: { type: "string", description: "Month to price the re-basing scenario in, YYYY-MM. Defaults to the first month under statutory rules." },
      ...AS_OF_PROP,
    },
  },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const statutory = ds.costPolicies.find((p) => p.socialInsurance !== null);
    const scenarioMonth = str(input.scenario_month) ?? monthOf(statutory?.effectiveFrom ?? asOf);
    const scenario = wageRebasingScenario(ds.people, scenarioMonth, ds.costPolicies);
    return {
      as_of: asOf,
      currency: "OMR",
      advisor_monthly_target_omr: omr(ds.settings.advisorMonthlyTargetBaisa),
      target_band_omr: omr(ds.settings.targetBandBaisa),
      bonus_bands: ds.settings.bonusBands.map((b) => ({
        id: b.id,
        label: b.label.en,
        min_volume_omr: omr(b.minVolumeBaisa),
        max_volume_omr: omrOrNull(b.maxVolumeBaisa),
        bonus_omr: omr(b.bonusBaisa),
      })),
      bonus_note: "Bands apply to advisors only. The founder's pay is an owner distribution, not a salary with a bonus.",
      working_week: "Sunday to Thursday, Asia/Muscat. Pace is measured in working days and suppressed before working day 3.",
      holidays: ds.settings.holidays,
      holidays_note: ds.settings.holidays.length === 0
        ? "No public holidays entered yet — pacing currently excludes Fridays and Saturdays only."
        : undefined,
      cost_policies: ds.costPolicies.map((p) => ({
        id: p.id,
        label: p.label.en,
        effective_from: p.effectiveFrom,
        note: p.note?.en,
      })),
      wage_rebasing_scenario: {
        month: scenarioMonth,
        current_monthly_payroll_omr: omr(scenario.currentBaisa),
        rebased_monthly_payroll_omr: omr(scenario.rebasedBaisa),
        monthly_increase_omr: omr(scenario.monthlyDeltaBaisa),
        annual_increase_omr: omr(scenario.annualDeltaBaisa),
        note: "A scenario only. Never booked as a cost unless the authorities actually re-base contributions on total wage.",
      },
    };
  },
};

const trendByMonth: CopilotTool = {
  name: "trend_by_month",
  description:
    "The month-by-month series — deals, volume and what was brought in — across a window, including months with " +
    "nothing in them. Optionally for one person. Use for 'show me the trend', 'which months were strong', " +
    "'are we growing'.",
  needsDb: false,
  input_schema: {
    type: "object",
    properties: {
      person: { type: "string", description: "Optional: limit to one advisor." },
      ...WINDOW_PROPS,
    },
  },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const window = windowFrom(input, ds, asOf);
    const needle = str(input.person);
    let scope = ds.deals;
    let person: Person | null = null;
    if (needle) {
      person = findPerson(ds, needle);
      if (!person) return personNotFound(ds, needle);
      scope = dealsForPerson(ds.deals, person.id);
    }
    const series = totalsByMonth(scope, window).map((row) => {
      const base = { month: row.month, ...totalsOut(row.totals) };
      if (!person) return base;
      const cost = personCost(person, { from: row.month, to: row.month }, ds.costPolicies).totalBaisa;
      return { ...base, cost_omr: omr(cost), contribution_omr: omr(row.totals.companyNetBaisa - cost) };
    });
    return {
      as_of: asOf,
      window,
      person: person ? { id: person.id, name: person.name.en } : null,
      currency: "OMR",
      series,
      totals: totalsOut(totalsOf(dealsInWindow(scope, window))),
    };
  },
};

const bonusCheck: CopilotTool = {
  name: "bonus_check",
  description:
    "Which bonus band a given monthly volume falls into and what it pays. Use for 'what does X have to sell to " +
    "hit the next band', 'what bonus does 300,000 earn'.",
  needsDb: false,
  input_schema: {
    type: "object",
    properties: {
      volume_omr: { type: "number", description: "Monthly sale volume in OMR." },
      ...AS_OF_PROP,
    },
    required: ["volume_omr"],
  },
  run: async (_db, input) => {
    const { ds, asOf } = datasetOr(input);
    const value = Number(input.volume_omr);
    if (!Number.isFinite(value)) return { error: "volume_omr must be a number" };
    const baisa = Math.round(value * 1000);
    const band = bandFor(baisa, ds.settings.bonusBands);
    const next = ds.settings.bonusBands
      .filter((b) => b.minVolumeBaisa > baisa)
      .sort((a, b) => a.minVolumeBaisa - b.minVolumeBaisa)[0];
    return {
      as_of: asOf,
      volume_omr: value,
      band: band ? { id: band.id, label: band.label.en, bonus_omr: omr(band.bonusBaisa) } : null,
      next_band: next
        ? {
            id: next.id,
            label: next.label.en,
            bonus_omr: omr(next.bonusBaisa),
            volume_needed_omr: omr(next.minVolumeBaisa),
            shortfall_omr: omr(next.minVolumeBaisa - baisa),
          }
        : null,
      note: "Bonus bands apply to advisors only.",
    };
  },
};

export const ceoTools: CopilotTool[] = [
  companyPosition,
  personReport,
  peopleStandings,
  monthDetail,
  costAndBreakEven,
  trendByMonth,
  listDeals,
  cashGap,
  dataQuality,
  settingsAndScenarios,
  bonusCheck,
];
