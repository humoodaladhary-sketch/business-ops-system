// Cover the public surface the acceptance test does not reach. An exported
// function with no test is a function the screens will be the first to exercise.
import { describe, expect, it } from "vitest";

import { assertBaisa, MoneyParseError, omrToBaisa, roundHalfUp, sumBaisa } from "../baisa";
import {
  DateParseError,
  compareDates,
  compareMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  monthOf,
  paceOfRange,
  parseIsoDate,
  parseMonthKey,
} from "../calendar";
import {
  CostPolicyError,
  activePeopleOn,
  addCost,
  isEmployedInMonth,
  overheadTotal,
  personCostUnderPolicy,
  policyForDate,
  policyForMonth,
  sortPolicies,
} from "../cost";
import { agentShare, dealsForPerson, dealsInWindow, inWindow, totalsByMonth } from "../deals";
import { isActiveOn, lifetimeWindow } from "../person";
import { SeedError, loadCostPolicies, loadProvisions } from "../seed";
import { AS_OF, dataset, personById } from "./fixtures";

describe("money helpers", () => {
  it("converts authored constants and sums exactly", () => {
    expect(omrToBaisa(550.5)).toBe(550_500);
    expect(sumBaisa([1, 2, 3])).toBe(6);
    expect(sumBaisa([])).toBe(0);
  });

  it("rounds half-up symmetrically about zero", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(-0.5)).toBe(-1);
    expect(roundHalfUp(2.4)).toBe(2);
  });

  it("catches a non-integer amount rather than letting it propagate", () => {
    expect(() => assertBaisa(1.5, "cost")).toThrow(MoneyParseError);
    expect(assertBaisa(1500)).toBe(1500);
    expect(() => omrToBaisa(Number.NaN)).toThrow(MoneyParseError);
  });
});

describe("date helpers", () => {
  it("parses, compares and bounds months", () => {
    expect(parseIsoDate("2026-08-25")).toEqual({ y: 2026, m: 8, d: 25 });
    expect(parseMonthKey("2026-08")).toEqual({ y: 2026, m: 8 });
    expect(monthOf("2026-08-25")).toBe("2026-08");
    expect(firstDayOfMonth("2026-02")).toBe("2026-02-01");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(compareDates("2026-01-01", "2026-02-01")).toBe(-1);
    expect(compareMonths("2026-02", "2026-02")).toBe(0);
  });

  it("handles a leap February", () => {
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
  });

  it("rejects malformed input instead of silently coercing", () => {
    expect(() => parseIsoDate("25-08-2026")).toThrow(DateParseError);
    expect(() => parseMonthKey("2026-13")).toThrow(DateParseError);
  });

  it("paces an arbitrary range for the quarter view", () => {
    const q3 = paceOfRange("2026-07-01", "2026-09-30", "2026-08-25");
    expect(q3.total).toBe(66);
    expect(q3.elapsed).toBe(40);
    expect(q3.measurable).toBe(true);

    const notStarted = paceOfRange("2026-10-01", "2026-12-31", "2026-08-25");
    expect(notStarted.elapsed).toBe(0);
    expect(notStarted.measurable).toBe(false);
  });
});

describe("cost helpers", () => {
  it("orders policies oldest first and resolves one by date", () => {
    const { costPolicies } = dataset();
    expect(sortPolicies([...costPolicies].reverse()).map((p) => p.id)).toEqual([
      "informal-2026-01",
      "statutory-2026-09",
    ]);
    expect(policyForDate(costPolicies, "2026-08-31").id).toBe("informal-2026-01");
    expect(policyForDate(costPolicies, "2026-09-01").id).toBe("statutory-2026-09");
  });

  it("governs the whole month a policy starts in", () => {
    const { costPolicies } = dataset();
    // The statutory policy starts on the 1st, but even a mid-month start would
    // govern that month — payroll is run monthly, not pro-rata.
    expect(policyForMonth(costPolicies, "2026-09").id).toBe("statutory-2026-09");
  });

  it("costs a roster under a chosen policy, ignoring employment dates", () => {
    const { costPolicies } = dataset();
    const statutory = policyForMonth(costPolicies, "2026-09");
    // Pasha left in May, but "what would he cost under these rules" still answers.
    const cost = personCostUnderPolicy(personById("pasha"), statutory);
    expect(cost.totalBaisa).toBe(200_000);
    expect(isEmployedInMonth(personById("pasha"), "2026-09")).toBe(false);
  });

  it("adds cost breakdowns component-wise", () => {
    const { costPolicies } = dataset();
    const policy = policyForMonth(costPolicies, "2026-09");
    const a = personCostUnderPolicy(personById("safaa"), policy);
    const b = personCostUnderPolicy(personById("wesam"), policy);
    const sum = addCost(a, b);
    expect(sum.totalBaisa).toBe(a.totalBaisa + b.totalBaisa);
    expect(sum.socialInsuranceBaisa).toBe(a.socialInsuranceBaisa);
    expect(sum.eosAccrualBaisa).toBe(b.eosAccrualBaisa);
  });

  it("separates priced overheads from the unpriced gap", () => {
    const { costPolicies } = dataset();
    const totals = overheadTotal(policyForMonth(costPolicies, "2026-08"));
    expect(totals.pricedBaisa).toBe(550_500);
    expect(totals.unpricedCount).toBe(7);
    expect(totals.unpriced.every((o) => o.amountBaisa === null)).toBe(true);
  });

  it("lists who is on the books on a date", () => {
    const { people } = dataset();
    expect(activePeopleOn(people, AS_OF)).toHaveLength(10);
    expect(activePeopleOn(people, "2026-02-01")).toHaveLength(10);
    expect(activePeopleOn(people, "2026-02-01").map((p) => p.id)).toContain("pasha");
    expect(activePeopleOn(people, "2026-02-01").map((p) => p.id)).not.toContain("khalid");
  });

  it("throws rather than costing a month no policy covers", () => {
    const { costPolicies } = dataset();
    expect(() => policyForMonth(costPolicies, "2025-06")).toThrow(CostPolicyError);
  });
});

describe("deal selection helpers", () => {
  it("filters by window and by person", () => {
    const { deals } = dataset();
    expect(dealsInWindow(deals, { from: "2026-01", to: "2026-01" })).toHaveLength(6);
    expect(dealsForPerson(deals, "shatha")).toHaveLength(21);
    expect(dealsForPerson(deals, "nobody")).toHaveLength(0);

    const jan = deals.find((d) => d.month === "2026-01")!;
    expect(inWindow(jan, { from: "2026-01", to: "2026-08" })).toBe(true);
    expect(inWindow(jan, { from: "2026-02", to: "2026-08" })).toBe(false);
  });

  it("reports the advisor's own take", () => {
    const deal = dataset().deals.find((d) => d.ref === "SHA-0002")!;
    expect(agentShare(deal)).toBe(deal.agentAmountBaisa);
  });

  it("buckets by month including months with no deals", () => {
    const { deals } = dataset();
    const rows = totalsByMonth(deals, { from: "2026-01", to: "2026-12" });
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.totals.count)).toEqual([6, 13, 3, 6, 5, 1, 2, 2, 0, 0, 0, 0]);
    // A month with no deals is zero, not missing.
    expect(rows[8]).toEqual({ month: "2026-09", totals: expect.objectContaining({ count: 0 }) });
  });
});

describe("person window helpers", () => {
  it("treats the leaving date as the last active day", () => {
    const pasha = personById("pasha");
    expect(isActiveOn(pasha, "2026-05-31")).toBe(true);
    expect(isActiveOn(pasha, "2026-06-01")).toBe(false);
  });

  it("does not consider someone active before their baseline", () => {
    expect(isActiveOn(personById("khalid"), "2026-05-31")).toBe(false);
    expect(isActiveOn(personById("khalid"), "2026-06-01")).toBe(true);
  });

  it("spans a lifetime window from the baseline to the measurement date", () => {
    expect(lifetimeWindow(personById("khalid"), AS_OF)).toEqual({ from: "2026-06", to: "2026-08" });
  });
});

describe("seed loaders reject malformed data", () => {
  it("requires at least one cost policy", () => {
    expect(() => loadCostPolicies({ policies: [] })).toThrow(SeedError);
  });

  it("rejects an unknown payroll class in a statutory rule", () => {
    expect(() =>
      loadCostPolicies({
        policies: [{
          id: "x", label: { en: "X", ar: "س" }, effectiveFrom: "2026-01-01", overheads: [],
          socialInsurance: { ratePct: 11.5, contributoryWageCapOmr: "3000.000", basis: "basic", appliesTo: ["Martian"] },
          endOfService: null,
        }],
      }),
    ).toThrow(SeedError);
  });

  it("rejects an unknown provision status", () => {
    expect(() =>
      loadProvisions({
        provisions: [{
          id: "p", label: { en: "P", ar: "ب" }, amountOmr: null,
          flag: { en: "f", ar: "ف" }, status: "maybe",
        }],
      }),
    ).toThrow(SeedError);
  });

  it("loads a provision with a known amount as well as an unknown one", () => {
    const [priced] = loadProvisions({
      provisions: [{
        id: "p", label: { en: "P", ar: "ب" }, amountOmr: "1234.500",
        flag: { en: "f", ar: "ف" }, status: "open",
      }],
    });
    expect(priced.amountBaisa).toBe(1_234_500);
  });
});
