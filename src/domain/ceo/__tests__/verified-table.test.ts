// THE ACCEPTANCE TEST.
//
// The CEO published a table of figures measured from 2026-01-01 (Khalid and
// Suleiman from 2026-06-01) to 2026-08-25, derived independently of this code.
// That table is the oracle. If the calc layer cannot reproduce it from the CSV,
// nothing else in the system may be built — a beautiful interface over wrong
// maths just makes the wrong number more convincing.
//
// Every expected value below is transcribed from the published table, not read
// back out of the implementation.
import { describe, expect, it } from "vitest";

import { baisaToOmr, formatOmr } from "../baisa";
import { companySummary, derivedRates, standings } from "../company";
import { breakEvenVolume, fixedCostForMonth, monthlyPayroll, runRateFixedCost, wageRebasingScenario } from "../cost";
import { companyKeepRate, effectiveCommissionRate, openReferralLiabilities, totalsOf } from "../deals";
import { contribution, lifetimeSummary, paybackMonth, tenureMonths } from "../person";
import { AS_OF, WINDOW, dataset, personById } from "./fixtures";

/** Round baisa to whole OMR, the unit the published table is stated in. */
const omr = (baisa: number) => Math.round(baisaToOmr(baisa));

describe("the 2026 deal book loads", () => {
  it("imports all 38 deals with every advisor resolved", () => {
    const { deals, people } = dataset();
    expect(deals).toHaveLength(38);
    expect(people).toHaveLength(12);
    expect(deals.every((d) => people.some((p) => p.id === d.advisorId))).toBe(true);
  });
});

describe("verified table — per person, 2026-01-01 to 2026-08-25", () => {
  const cases = [
    { id: "shatha", months: 8, deals: 21, volume: 1_696_795, broughtIn: 38_637, cost: 2_800, net: 35_837, ret: 13.8 },
    { id: "pasha", months: 5, deals: 4, volume: 273_031, broughtIn: 5_752, cost: 1_000, net: 4_752, ret: 5.8 },
    { id: "wesam", months: 8, deals: 5, volume: 355_980, broughtIn: 8_554, cost: 2_800, net: 5_754, ret: 3.1 },
    { id: "alex", months: 8, deals: 4, volume: 255_380, broughtIn: 6_992, cost: 2_800, net: 4_192, ret: 2.5 },
    { id: "humood", months: 8, deals: 4, volume: 510_040, broughtIn: 9_621, cost: 16_000, net: -6_379, ret: 0.6 },
    { id: "yousef", months: 3, deals: 0, volume: 0, broughtIn: 0, cost: 2_250, net: -2_250, ret: 0.0 },
  ] as const;

  it.each(cases)("$id: $deals deals, $volume volume, $broughtIn in, $cost cost, $ret x", (c) => {
    const { deals, costPolicies } = dataset();
    const person = personById(c.id);
    const result = contribution(person, deals, WINDOW, costPolicies);

    expect(result.months).toBe(c.months);
    expect(result.deals?.count).toBe(c.deals);
    expect(omr(result.deals!.volumeBaisa)).toBe(c.volume);
    expect(omr(result.broughtInBaisa!)).toBe(c.broughtIn);
    expect(omr(result.costBaisa)).toBe(c.cost);
    expect(omr(result.netBaisa!)).toBe(c.net);
    expect(result.returnMultiple).toBeCloseTo(c.ret, 1);
    expect(tenureMonths(person, AS_OF)).toBe(c.months);
  });

  // The support staff rows carry a cost and an em-dash, never a zero. A "0
  // deals" on a marketing manager's card is a bug, not a fact.
  const kpiScored = [
    { id: "khalid", months: 3, cost: 450 },
    { id: "suleiman", months: 3, cost: 450 },
    { id: "safaa", months: 8, cost: 5_200 },
    { id: "abeer", months: 8, cost: 3_600 },
    { id: "abdulahad", months: 8, cost: 1_200 },
    { id: "abdullah", months: 8, cost: 400 },
  ] as const;

  it.each(kpiScored)("$id is KPI-scored: $cost cost, no revenue metrics", (c) => {
    const { deals, costPolicies } = dataset();
    const result = contribution(personById(c.id), deals, WINDOW, costPolicies);

    expect(result.months).toBe(c.months);
    expect(omr(result.costBaisa)).toBe(c.cost);
    expect(result.revenueScored).toBe(false);
    // Null, not zero — the table shows an em-dash for a reason.
    expect(result.deals).toBeNull();
    expect(result.broughtInBaisa).toBeNull();
    expect(result.netBaisa).toBeNull();
    expect(result.returnMultiple).toBeNull();
  });
});

describe("verified table — company row", () => {
  it("38 deals, 3,091,226 volume, 69,556 in, 38,950 cost, +30,606 net, 1.8x", () => {
    const { people, deals, costPolicies } = dataset();
    const summary = companySummary(people, deals, WINDOW, costPolicies);

    expect(summary.deals.count).toBe(38);
    expect(omr(summary.deals.volumeBaisa)).toBe(3_091_226);
    expect(omr(summary.deals.companyNetBaisa)).toBe(69_556);
    expect(omr(summary.totalCostBaisa)).toBe(38_950);
    expect(omr(summary.netBaisa)).toBe(30_606);
    expect(summary.returnMultiple).toBeCloseTo(1.8, 1);
  });

  it("holds to the exact baisa, independently computed from the CSV", () => {
    const { people, deals, costPolicies } = dataset();
    const summary = companySummary(people, deals, WINDOW, costPolicies);

    expect(summary.deals.volumeBaisa).toBe(3_091_225_563);
    expect(summary.deals.companyNetBaisa).toBe(69_556_093);
    expect(summary.totalCostBaisa).toBe(38_950_000);
  });

  it("keeps departed people in the record — dropping them overstates performance", () => {
    const { people, deals, costPolicies } = dataset();
    const withAll = companySummary(people, deals, WINDOW, costPolicies);
    const survivorsOnly = people.filter((p) => p.endedAt === null);
    const withoutDeparted = companySummary(survivorsOnly, deals, WINDOW, costPolicies);

    // Pasha's 4 deals and Yousef's zero-revenue cost both belong to 2026.
    expect(withoutDeparted.totalCostBaisa).toBeLessThan(withAll.totalCostBaisa);
    expect(withoutDeparted.returnMultiple!).toBeGreaterThan(withAll.returnMultiple!);
  });

  it("separates the owner distribution without removing it from company cost", () => {
    const { people, deals, costPolicies } = dataset();
    const summary = companySummary(people, deals, WINDOW, costPolicies);

    expect(omr(summary.ownerDistributionBaisa)).toBe(16_000);
    expect(omr(summary.operatingCostBaisa)).toBe(22_950);
    expect(summary.operatingCostBaisa + summary.ownerDistributionBaisa).toBe(summary.totalCostBaisa);
  });

  it("never ranks the founder among the advisors", () => {
    const { people, deals, costPolicies } = dataset();
    const ranked = standings(people, deals, WINDOW, costPolicies).filter(
      (s) => s.person.personClass === "Advisor",
    );
    expect(ranked.map((s) => s.person.id)).toEqual(["shatha", "pasha", "wesam", "alex", "yousef"]);
    expect(ranked.some((s) => s.person.id === "humood")).toBe(false);
  });
});

describe("derived rates — produced from the book, never hardcoded", () => {
  it("effective commission rate is 3.6338% of volume", () => {
    const rate = effectiveCommissionRate(dataset().deals)!;
    expect(rate * 100).toBeCloseTo(3.6338, 4);
  });

  it("company keep rate is 2.2501% of volume", () => {
    const rate = companyKeepRate(dataset().deals)!;
    expect(rate * 100).toBeCloseTo(2.2501, 4);
  });

  it("open referral liabilities total 3,054.20 — Mohammed 1,969.20, Eng. Bayda 1,085.00", () => {
    const liabilities = openReferralLiabilities(dataset().deals);
    expect(liabilities.map((l) => formatOmr(l.amountBaisa, { decimals: 2 }))).toEqual([
      "1,969.20",
      "1,085.00",
    ]);
    const total = liabilities.reduce((s, l) => s + l.amountBaisa, 0);
    expect(formatOmr(total, { decimals: 2 })).toBe("3,054.20");
  });
});

describe("cost policy — the September change is a row, not a deploy", () => {
  const runRate = (policyMonth: string) =>
    runRateFixedCost(dataset().people, AS_OF, policyMonth, dataset().costPolicies);

  it("monthly payroll is 4,650.00 before September and 4,993.50 from September (+343.50)", () => {
    const before = runRate("2026-08");
    const after = runRate("2026-09");

    expect(formatOmr(before.payrollBaisa, { decimals: 2 })).toBe("4,650.00");
    expect(formatOmr(after.payrollBaisa, { decimals: 2 })).toBe("4,993.50");
    expect(formatOmr(after.payrollBaisa - before.payrollBaisa, { decimals: 2 })).toBe("343.50");
  });

  it("run-rate uses the 10 currently active people, not the 12 seeded", () => {
    expect(runRate("2026-08").activeHeadcount).toBe(10);
    expect(dataset().people).toHaveLength(12);
  });

  it("fixed cost is 5,200.50 before September and 5,544.00 from September", () => {
    expect(formatOmr(runRate("2026-08").totalBaisa, { decimals: 2 })).toBe("5,200.50");
    expect(formatOmr(runRate("2026-09").totalBaisa, { decimals: 2 })).toBe("5,544.00");
  });

  it("break-even rises from 231,122 to 246,388 OMR of monthly volume", () => {
    const keepRate = companyKeepRate(dataset().deals);
    expect(omr(breakEvenVolume(runRate("2026-08").totalBaisa, keepRate)!)).toBe(231_122);
    expect(omr(breakEvenVolume(runRate("2026-09").totalBaisa, keepRate)!)).toBe(246_388);
  });

  it("the higher September cost comes from the policy, not from a changed constant", () => {
    const { people, costPolicies } = dataset();
    // Same people, same salaries, same code — only the month differs.
    const august = monthlyPayroll(people, "2026-08", costPolicies);
    const september = monthlyPayroll(people, "2026-09", costPolicies);

    expect(august.breakdown.socialInsuranceBaisa).toBe(0);
    expect(august.breakdown.eosAccrualBaisa).toBe(0);
    expect(formatOmr(september.breakdown.socialInsuranceBaisa, { decimals: 2 })).toBe("333.50");
    expect(formatOmr(september.breakdown.eosAccrualBaisa, { decimals: 2 })).toBe("10.00");
  });

  it("still shows seven unpriced cost items as a visible gap, never as zero", () => {
    expect(runRate("2026-08").unpricedCostItems).toBe(7);
    expect(runRate("2026-09").unpricedCostItems).toBe(7);
  });
});

describe("provisions the system surfaces but does not calculate", () => {
  it("carries the retroactive social-insurance liability with no amount", () => {
    const provision = dataset().provisions.find((p) => p.id === "retroactive-social-insurance")!;
    expect(provision.amountBaisa).toBeNull();
    expect(provision.flag.en).toBe("amount unknown — confirm with SPF");
    expect(provision.status).toBe("open");
  });

  it("prices wage re-basing as a scenario: about 97.75 a month, 1,173 a year", () => {
    const { people, costPolicies } = dataset();
    const scenario = wageRebasingScenario(people, "2026-09", costPolicies);
    expect(formatOmr(scenario.monthlyDeltaBaisa, { decimals: 2 })).toBe("97.75");
    expect(omr(scenario.annualDeltaBaisa)).toBe(1_173);
  });

  it("does not book the re-basing scenario into actual cost", () => {
    const { people, costPolicies } = dataset();
    const actual = monthlyPayroll(people, "2026-09", costPolicies).totalBaisa;
    const scenario = wageRebasingScenario(people, "2026-09", costPolicies);
    expect(scenario.currentBaisa).toBe(actual);
    expect(scenario.rebasedBaisa).toBeGreaterThan(actual);
  });
});

describe("payback months in 2026", () => {
  it.each([
    { id: "shatha", month: "2026-01" },
    { id: "wesam", month: "2026-01" },
    { id: "alex", month: "2026-02" },
  ])("$id paid back in $month", ({ id, month }) => {
    const { deals, costPolicies } = dataset();
    expect(paybackMonth(personById(id), deals, AS_OF, costPolicies)).toBe(month);
  });

  it("the founder has not paid back yet", () => {
    const { deals, costPolicies } = dataset();
    expect(paybackMonth(personById("humood"), deals, AS_OF, costPolicies)).toBeNull();
  });

  it("asks no payback question of people who cannot generate revenue", () => {
    const { deals, costPolicies } = dataset();
    expect(paybackMonth(personById("abeer"), deals, AS_OF, costPolicies)).toBeNull();
    expect(lifetimeSummary(personById("abeer"), deals, AS_OF, costPolicies).revenueScored).toBe(false);
  });
});

describe("historical fixed cost is not the run rate", () => {
  it("January actually cost more than today's run rate — Pasha and Yousef were on the books", () => {
    const { people, costPolicies } = dataset();
    const january = fixedCostForMonth(people, "2026-01", costPolicies);
    const runRate = runRateFixedCost(people, AS_OF, "2026-08", costPolicies);

    expect(january.headcount).toBe(10); // Khalid and Suleiman had not started
    expect(formatOmr(january.payrollBaisa, { decimals: 2 })).toBe("5,300.00");
    expect(january.payrollBaisa).toBeGreaterThan(runRate.payrollBaisa);
  });
});

describe("the derived-rates bundle used by the screens", () => {
  it("produces break-even per month, stepping up in September", () => {
    const { people, deals, costPolicies } = dataset();
    const rates = derivedRates(people, deals, { from: "2026-08", to: "2026-09" }, costPolicies);
    const [august, september] = rates.breakEvenByMonth;

    expect(august.month).toBe("2026-08");
    expect(september.month).toBe("2026-09");
    expect(september.breakEvenVolumeBaisa!).toBeGreaterThan(august.breakEvenVolumeBaisa!);
  });
});

describe("the source sheet's own net column", () => {
  it("disagrees with its components by 2 baisa across the book — formula wins", () => {
    const { deals } = dataset();
    const fromFormula = totalsOf(deals).companyNetBaisa;
    const fromSheet = deals.reduce((s, d) => s + d.recordedCompanyNetBaisa, 0);

    expect(fromFormula - fromSheet).toBe(2);
    // Both round to the same published OMR figure, so the table still holds.
    expect(omr(fromFormula)).toBe(omr(fromSheet));
  });
});
