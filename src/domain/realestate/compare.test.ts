import { describe, expect, it } from "vitest";
import { buildComparison } from "./compare";
import type { OfferUnit } from "./offer";

const unit = (over: Partial<OfferUnit>): OfferUnit => ({
  reference: "U1",
  project: "Jebel Sifah",
  developer: "Muriya",
  unitType: "1BR Apartment",
  areaSqm: 80,
  priceOmr: 80000,
  category: "ITC",
  ownershipEligibility: "all_nationalities",
  ...over,
});

describe("buildComparison", () => {
  it("rejects shortlists that are not 2–3 units", () => {
    expect(() => buildComparison({ clientName: "A", nationality: "British", goal: "Residency", budgetOmr: 0, units: [unit({})] })).toThrow();
  });

  it("never recommends a GCC-only unit to a non-GCC client", () => {
    const res = buildComparison({
      clientName: "Jilal",
      nationality: "British",
      goal: "Capital growth",
      budgetOmr: 300000,
      units: [
        unit({ reference: "SHC-1", project: "Wadi Zaha", category: "future_cities", ownershipEligibility: "gcc_omani_only", priceOmr: 90000 }),
        unit({ reference: "JS-2", priceOmr: 120000 }),
      ],
    });
    expect(res.recommendedRef).toBe("JS-2");
    const excluded = res.rows.find((r) => r.unit.reference === "SHC-1")!;
    expect(excluded.eligible).toBe(false);
    expect(excluded.score).toBe(0);
    expect(excluded.reasons[0]).toMatch(/Excluded/);
  });

  it("prefers within-budget units and rewards the residency threshold when that is the goal", () => {
    const res = buildComparison({
      clientName: "Dr. Ali",
      nationality: "Lebanese",
      goal: "Residency",
      budgetOmr: 250000,
      units: [
        unit({ reference: "BIG", priceOmr: 210000, areaSqm: 150 }), // golden tier, within budget
        unit({ reference: "OVER", priceOmr: 300000, areaSqm: 220 }), // over budget
        unit({ reference: "SMALL", priceOmr: 60000, areaSqm: 55 }), // investor tier only
      ],
    });
    expect(res.recommendedRef).toBe("BIG");
    const big = res.rows.find((r) => r.unit.reference === "BIG")!;
    expect(big.reasons).toContain("Within the stated budget");
    expect(big.reasons.join(" ")).toMatch(/Golden\/Investor Residency threshold/);
    const over = res.rows.find((r) => r.unit.reference === "OVER")!;
    expect(over.withinBudget).toBe(false);
  });

  it("reports no recommendation when nothing is eligible, steering to ITC", () => {
    const res = buildComparison({
      clientName: "Mortaza",
      nationality: "Bangladeshi",
      goal: "Rental income",
      budgetOmr: 0,
      units: [
        unit({ reference: "A", category: "surooh", ownershipEligibility: "gcc_omani_only" }),
        unit({ reference: "B", category: "future_cities", ownershipEligibility: "gcc_omani_only" }),
      ],
    });
    expect(res.recommendedRef).toBeNull();
    expect(res.recommendationReasons[0]).toMatch(/ITC freehold/);
  });

  it("keeps budget neutral when none is given", () => {
    const res = buildComparison({
      clientName: "",
      nationality: "Omani",
      goal: "Lifestyle",
      budgetOmr: 0,
      units: [unit({ reference: "A", areaSqm: 100 }), unit({ reference: "B", areaSqm: 140, priceOmr: 100000 })],
    });
    for (const r of res.rows) expect(r.withinBudget).toBeNull();
    expect(res.recommendedRef).toBe("B"); // largest area wins the lifestyle goal
  });
});
