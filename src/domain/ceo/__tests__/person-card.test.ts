// The person card: role-owned metrics, pace, bands, and direction.
//
// The rule under test throughout: a card only shows metrics the role owns, and
// "empty" is a legitimate answer. Showing "0 deals" on a marketing manager's
// card is a bug, not a fact.
import { describe, expect, it } from "vitest";

import { formatOmr } from "../baisa";
import { paceOfMonth } from "../calendar";
import {
  bandFor,
  isRankedAgainstAdvisors,
  isRevenueScored,
  lifetimeSummary,
  monthPerformance,
  monthlyLedger,
  paceIndex,
  projection,
  quarterWindow,
  trend,
} from "../person";
import type { Deal, Person } from "../types";
import { AS_OF, dataset, personById } from "./fixtures";

/** A minimal deal that nets exactly `netBaisa` to the company. */
function makeDeal(o: { ref: string; month: string; advisorId: string; netBaisa: number }): Deal {
  return {
    ref: o.ref,
    month: o.month,
    advisorId: o.advisorId,
    developer: "Test",
    project: "Test",
    unitType: "Test",
    unitValueBaisa: o.netBaisa * 40,
    commissionPct: 3,
    grossCommissionBaisa: o.netBaisa,
    incentiveBaisa: 0,
    referralPayee: null,
    referralPct: 0,
    referralBaisa: 0,
    agentCutPct: 0,
    agentAmountBaisa: 0,
    recordedCompanyNetBaisa: o.netBaisa,
    stage: "SPA_SIGNED",
    invoiced: "yes",
    collected: "yes",
  };
}

describe("which metrics a role owns", () => {
  it.each([
    ["Advisor", true],
    ["Owner", true],
    ["Inventory", false],
    ["LeadEngine", false],
    ["Marketing", false],
    ["Finance", false],
    ["Contractor", false],
  ] as const)("%s revenue-scored: %s", (personClass, expected) => {
    expect(isRevenueScored(personClass)).toBe(expected);
  });

  it("returns no revenue metrics at all for a marketing manager", () => {
    const { deals, costPolicies, settings } = dataset();
    const card = monthPerformance(personById("abeer"), deals, "2026-08", AS_OF, costPolicies, settings);

    expect(card.revenueScored).toBe(false);
    expect(card.volumeBaisa).toBeNull();
    expect(card.targetBaisa).toBeNull();
    expect(card.paceIndex).toBeNull();
    expect(card.projectedVolumeBaisa).toBeNull();
    expect(card.currentBand).toBeNull();
    expect(card.deals).toBeNull();
    // But her cost is always shown — the CEO needs the full cost picture.
    expect(formatOmr(card.costBaisa, { decimals: 3 })).toBe("450.000");
  });

  it("shows a real zero for an advisor who genuinely sold nothing", () => {
    const { deals, costPolicies, settings } = dataset();
    const card = monthPerformance(personById("alex"), deals, "2026-08", AS_OF, costPolicies, settings);

    // Alex is an advisor: zero is a fact about him, not a missing metric.
    expect(card.revenueScored).toBe(true);
    expect(card.volumeBaisa).toBe(0);
    expect(card.deals?.count).toBe(0);
  });

  it("keeps the founder off the advisor league table", () => {
    expect(isRankedAgainstAdvisors(personById("humood"))).toBe(false);
    expect(isRankedAgainstAdvisors(personById("shatha"))).toBe(true);
  });
});

describe("pace index and projection", () => {
  const pace = paceOfMonth("2026-02", "2026-02-05"); // 5 of 20 working days

  it("indexes actual against target, adjusted for how far into the month we are", () => {
    // A quarter of the month done with a quarter of target booked is exactly on pace.
    expect(paceIndex(62_500_000, 250_000_000, pace)).toBeCloseTo(1, 10);
    expect(paceIndex(125_000_000, 250_000_000, pace)).toBeCloseTo(2, 10);
  });

  it("projects where the month lands at this rate", () => {
    expect(projection(62_500_000, pace)).toBe(250_000_000);
  });

  it("suppresses both before working day 3 rather than raising a false alarm", () => {
    const tooEarly = paceOfMonth("2026-02", "2026-02-02"); // working day 2
    expect(tooEarly.measurable).toBe(false);
    expect(paceIndex(50_000_000, 250_000_000, tooEarly)).toBeNull();
    expect(projection(50_000_000, tooEarly)).toBeNull();
  });

  it("suppresses the month card's pace metrics too", () => {
    const { deals, costPolicies, settings } = dataset();
    const card = monthPerformance(personById("shatha"), deals, "2026-02", "2026-02-02", costPolicies, settings);
    expect(card.pace.measurable).toBe(false);
    expect(card.paceIndex).toBeNull();
    expect(card.projectedVolumeBaisa).toBeNull();
    // The underlying volume is still real and still shown.
    expect(card.volumeBaisa).toBeGreaterThan(0);
  });
});

describe("bonus bands", () => {
  const bands = () => dataset().settings.bonusBands;

  it.each([
    [0, "below", "0.000"],
    [189_999_999, "below", "0.000"],
    [190_000_000, "on-target", "150.000"],
    [250_000_000, "on-target", "150.000"],
    [309_999_999, "on-target", "150.000"],
    [310_000_000, "above", "200.000"],
    [499_999_999, "above", "200.000"],
    [500_000_000, "outstanding", "250.000"],
    [900_000_000, "outstanding", "250.000"],
  ])("volume %d falls in the %s band", (volume, id, bonus) => {
    const band = bandFor(volume, bands())!;
    expect(band.id).toBe(id);
    expect(formatOmr(band.bonusBaisa, { decimals: 3 })).toBe(bonus);
  });

  it("bands the target ±60,000 as the settings say", () => {
    const { advisorMonthlyTargetBaisa, targetBandBaisa } = dataset().settings;
    expect(formatOmr(advisorMonthlyTargetBaisa, { decimals: 0 })).toBe("250,000");
    expect(formatOmr(targetBandBaisa, { decimals: 0 })).toBe("60,000");
    expect(bandFor(advisorMonthlyTargetBaisa - targetBandBaisa, bands())!.id).toBe("on-target");
  });

  it("shows the current and the projected band, which can differ", () => {
    const { deals, costPolicies, settings } = dataset();
    // Shatha booked 606,865 across February on 20 working days.
    const card = monthPerformance(personById("shatha"), deals, "2026-02", "2026-02-05", costPolicies, settings);
    expect(card.currentBand?.id).toBe("outstanding");
    expect(card.projectedBand?.id).toBe("outstanding");
  });
});

describe("the payback trail", () => {
  it("shows month-by-month cumulative cost against cumulative income", () => {
    const { deals, costPolicies } = dataset();
    const ledger = monthlyLedger(personById("alex"), deals, { from: "2026-01", to: "2026-08" }, costPolicies);

    expect(ledger).toHaveLength(8);
    expect(ledger[0].month).toBe("2026-01");
    expect(ledger[0].broughtInBaisa).toBe(0);
    expect(ledger[0].paidBack).toBe(false);
    // February's three deals clear both months' cost at once.
    expect(ledger[1].paidBack).toBe(true);
    expect(ledger[1].cumulativeBroughtInBaisa).toBeGreaterThan(ledger[1].cumulativeCostBaisa);
  });

  it("stays paid back once it has happened", () => {
    const { deals, costPolicies } = dataset();
    const ledger = monthlyLedger(personById("shatha"), deals, { from: "2026-01", to: "2026-08" }, costPolicies);
    expect(ledger.every((r) => r.paidBack)).toBe(true);
  });
});

describe("direction, not level", () => {
  it("reads the founder as improving — his deals land in July and August", () => {
    const { deals, costPolicies } = dataset();
    // Humood's deals land in July and August; his cost runs all eight months.
    const t = trend(personById("humood"), deals, AS_OF, costPolicies);
    expect(t.direction).toBe("improving");
    expect(t.index).not.toBeNull();
  });

  it("reads an advisor whose recent months are quiet as declining", () => {
    const { deals, costPolicies } = dataset();
    // Alex sold in February and April, nothing since.
    expect(trend(personById("alex"), deals, AS_OF, costPolicies).direction).toBe("declining");
  });

  it("refuses to call a direction for people it cannot score", () => {
    const { deals, costPolicies } = dataset();
    const t = trend(personById("safaa"), deals, AS_OF, costPolicies);
    expect(t.direction).toBe("not-measurable");
    expect(t.index).toBeNull();
  });

  it("refuses to call a direction on too little history", () => {
    const { deals, costPolicies } = dataset();
    const t = trend(personById("khalid"), deals, "2026-07-31", costPolicies);
    expect(t.direction).toBe("not-measurable");
  });

  it("distinguishes two people at the SAME multiple heading opposite ways", () => {
    // The claim this whole field exists for: a person at 2.2x who is falling and
    // a person at 2.2x who is climbing are two different decisions. Built rather
    // than drawn from the book, so the assertion tests the function and not a
    // coincidence in six months of data.
    const { costPolicies } = dataset();
    const advisor = (id: string): Person => ({
      ...personById("alex"),
      id,
      endedAt: null,
    });

    // Same six monthly totals, one order reversed against the other.
    const rising = [1, 1, 1, 3, 4, 5];
    const falling = [...rising].reverse();
    const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
    const build = (id: string, shape: number[]) =>
      shape.map((units, i) => makeDeal({ ref: `${id}-${i}`, month: months[i], advisorId: id, netBaisa: units * 1_000_000 }));

    const climber = advisor("climber");
    const faller = advisor("faller");
    const deals = [...build("climber", rising), ...build("faller", falling)];
    const asOf = "2026-06-30";

    const climbing = lifetimeSummary(climber, deals, asOf, costPolicies);
    const dropping = lifetimeSummary(faller, deals, asOf, costPolicies);

    // Identical lifetime return...
    expect(climbing.lifetimeReturn).toBeCloseTo(dropping.lifetimeReturn!, 10);
    // ...and opposite directions.
    expect(climbing.trend.direction).toBe("improving");
    expect(dropping.trend.direction).toBe("declining");
  });
});

describe("the quarter tab", () => {
  it("spans the calendar quarter the month sits in", () => {
    expect(quarterWindow("2026-08")).toEqual({ from: "2026-07", to: "2026-09" });
    expect(quarterWindow("2026-01")).toEqual({ from: "2026-01", to: "2026-03" });
  });
});

describe("the today tab", () => {
  it("is legitimately empty for most people on most days", () => {
    const { deals, costPolicies, settings } = dataset();
    const card = monthPerformance(personById("wesam"), deals, "2026-08", AS_OF, costPolicies, settings);
    expect(card.deals?.count).toBe(0);
    expect(card.volumeBaisa).toBe(0);
  });
});
