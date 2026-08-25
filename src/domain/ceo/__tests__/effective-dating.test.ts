// The rule that makes every historical number trustworthy: nothing is
// overwritten. Raising a salary in September must leave August's cost and
// August's ROI exactly as they were. Retrofitting this later means rewriting
// everything, so it is tested from the first commit.
import { describe, expect, it } from "vitest";

import { formatOmr, omrStringToBaisa } from "../baisa";
import { companySummary } from "../company";
import {
  CostPolicyError,
  payrollClassificationGaps,
  personCost,
  personMonthlyCost,
  policyForMonth,
} from "../cost";
import { contribution } from "../person";
import type { CostPolicy, Person } from "../types";
import { AS_OF, WINDOW, dataset, personById } from "./fixtures";

describe("policy resolution", () => {
  it("picks the informal policy through August and the statutory one from September", () => {
    const { costPolicies } = dataset();
    expect(policyForMonth(costPolicies, "2026-01").id).toBe("informal-2026-01");
    expect(policyForMonth(costPolicies, "2026-08").id).toBe("informal-2026-01");
    expect(policyForMonth(costPolicies, "2026-09").id).toBe("statutory-2026-09");
    expect(policyForMonth(costPolicies, "2027-06").id).toBe("statutory-2026-09");
  });

  it("refuses to guess when no policy covers the month", () => {
    const { costPolicies } = dataset();
    expect(() => policyForMonth(costPolicies, "2025-12")).toThrow(CostPolicyError);
  });
});

describe("a salary raise in September", () => {
  // The same person, given a raise effective September, modelled the only way
  // the system allows: a new effective-dated record, never an edit in place.
  const raiseFrom = (person: Person, newBasicOmr: string): Person => ({
    ...person,
    id: `${person.id}-v2`,
    basicBaisa: omrStringToBaisa(newBasicOmr),
    measurementStartDate: "2026-09-01",
  });

  it("leaves August's cost and August's return exactly as they were", () => {
    const { deals, costPolicies } = dataset();
    const shatha = personById("shatha");

    const before = contribution(shatha, deals, WINDOW, costPolicies);

    const ended: Person = { ...shatha, endedAt: "2026-08-31" };
    const raised = raiseFrom(shatha, "900.000");
    const after = contribution(ended, deals, WINDOW, costPolicies);

    expect(after.costBaisa).toBe(before.costBaisa);
    expect(after.returnMultiple).toBe(before.returnMultiple);
    // And the raise only bites from September.
    expect(personCost(raised, { from: "2026-01", to: "2026-08" }, costPolicies).totalBaisa).toBe(0);
    expect(formatOmr(personCost(raised, { from: "2026-09", to: "2026-09" }, costPolicies).totalBaisa, { decimals: 2 })).toBe(
      "1,103.50",
    );
  });

  it("does not disturb the published company figures", () => {
    const { people, deals, costPolicies } = dataset();
    const baseline = companySummary(people, deals, WINDOW, costPolicies);

    const withRaise = [
      ...people.map((p) => (p.id === "shatha" ? { ...p, endedAt: "2026-08-31" } : p)),
      raiseFrom(personById("shatha"), "900.000"),
    ];
    const after = companySummary(withRaise, deals, WINDOW, costPolicies);

    expect(after.totalCostBaisa).toBe(baseline.totalCostBaisa);
    expect(after.netBaisa).toBe(baseline.netBaisa);
  });
});

describe("employment boundaries", () => {
  it("charges the start month and the end month in full", () => {
    const { costPolicies } = dataset();
    const pasha = personById("pasha");
    // Left 31 May: charged January through May, five months.
    expect(personCost(pasha, WINDOW, costPolicies).months).toBe(5);
    expect(personMonthlyCost(pasha, "2026-05", costPolicies).totalBaisa).toBe(200_000);
    expect(personMonthlyCost(pasha, "2026-06", costPolicies).totalBaisa).toBe(0);
  });

  it("charges nothing before a person's measurement baseline", () => {
    const { costPolicies } = dataset();
    const khalid = personById("khalid");
    expect(personMonthlyCost(khalid, "2026-05", costPolicies).totalBaisa).toBe(0);
    expect(personMonthlyCost(khalid, "2026-06", costPolicies).totalBaisa).toBe(150_000);
  });

  it("keeps the measurement baseline separate from the legal hire date", () => {
    // The baseline is where the deal record starts, not when someone was hired.
    // Conflating the two would silently backdate cost onto months with no revenue.
    for (const person of dataset().people) {
      expect(person.measurementStartDate).toBeTruthy();
      expect(person.hireDate).toBeNull();
    }
  });
});

describe("statutory cost applies per payroll class", () => {
  const september = "2026-09";

  it("charges Omani staff social insurance on basic, and nothing else", () => {
    const { costPolicies } = dataset();
    const cost = personMonthlyCost(personById("safaa"), september, costPolicies);
    // 250 basic x 11.5%
    expect(formatOmr(cost.socialInsuranceBaisa, { decimals: 3 })).toBe("28.750");
    expect(cost.eosAccrualBaisa).toBe(0);
  });

  it("charges expatriate staff end-of-service accrual on basic", () => {
    const { costPolicies } = dataset();
    const cost = personMonthlyCost(personById("wesam"), september, costPolicies);
    // 60 basic / 12
    expect(formatOmr(cost.eosAccrualBaisa, { decimals: 3 })).toBe("5.000");
    expect(cost.socialInsuranceBaisa).toBe(0);
  });

  it("charges contractors neither", () => {
    const { costPolicies } = dataset();
    const cost = personMonthlyCost(personById("abdulahad"), september, costPolicies);
    expect(cost.socialInsuranceBaisa).toBe(0);
    expect(cost.eosAccrualBaisa).toBe(0);
  });

  it("caps social insurance at the contributory wage ceiling", () => {
    const { costPolicies } = dataset();
    const policy = policyForMonth(costPolicies, september);
    const highEarner: Person = {
      ...personById("humood"),
      id: "test-high-earner",
      basicBaisa: omrStringToBaisa("5000.000"),
    };
    const cost = personMonthlyCost(highEarner, september, [policy as CostPolicy]);
    // Assessed on the 3,000 cap, not on 5,000.
    expect(formatOmr(cost.socialInsuranceBaisa, { decimals: 3 })).toBe("345.000");
  });

  it("surfaces unconfirmed payroll classes as a gap rather than as nil cost", () => {
    const { people, costPolicies } = dataset();
    // Pasha and Yousef are Unclassified but both left before the statutory
    // policy begins, so they raise no gap and affect no published figure.
    expect(payrollClassificationGaps(people, september, costPolicies)).toEqual([]);

    const stillHere = people.map((p) => (p.id === "pasha" ? { ...p, endedAt: null } : p));
    expect(payrollClassificationGaps(stillHere, september, costPolicies).map((p) => p.id)).toEqual([
      "pasha",
    ]);
  });

  it("raises no gap while no statutory policy is in force", () => {
    const { people, costPolicies } = dataset();
    expect(payrollClassificationGaps(people, "2026-03", costPolicies)).toEqual([]);
  });
});

describe("the measurement window itself", () => {
  it("measures Khalid and Suleiman from June, everyone else from January", () => {
    for (const person of dataset().people) {
      const expected = ["khalid", "suleiman"].includes(person.id) ? "2026-06-01" : "2026-01-01";
      expect(person.measurementStartDate).toBe(expected);
    }
  });

  it("counts tenure to the measurement date, not to the end of the month", () => {
    const { costPolicies } = dataset();
    expect(personCost(personById("khalid"), { from: "2026-01", to: "2026-08" }, costPolicies).months).toBe(3);
    expect(AS_OF).toBe("2026-08-25");
  });
});
