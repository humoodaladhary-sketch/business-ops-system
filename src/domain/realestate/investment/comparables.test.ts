import { describe, it, expect } from "vitest";
import { haversineKm, summarizeComparables, type ComparableProperty } from "./comparables";

const comp = (over: Partial<ComparableProperty>): ComparableProperty => ({
  reference: "C1",
  project: "Test Project",
  areaSqm: 100,
  dataSource: "manual import",
  provenance: "observed",
  ...over,
});

describe("summarizeComparables", () => {
  it("computes averages, medians, price/m² and the subject premium", () => {
    const comps = [
      comp({ reference: "A", areaSqm: 100, askingPriceOmr: 100000 }), // 1000/m²
      comp({ reference: "B", areaSqm: 120, askingPriceOmr: 132000 }), // 1100/m²
      comp({ reference: "C", areaSqm: 80, askingPriceOmr: 96000 }), // 1200/m²
    ];
    const s = summarizeComparables(comps, { areaSqm: 110, priceOmr: 132000 }); // subject 1200/m²
    expect(s.count).toBe(3);
    expect(s.medianPriceOmr).toBe(100000);
    expect(s.medianPricePerSqmOmr).toBe(1100);
    expect(s.avgPricePerSqmOmr).toBe(1100);
    // subject at 1200 vs median 1100 → +9.09%
    expect(s.subjectPremiumPct).toBe(9.09);
    // comp-implied value = 1100 × 110
    expect(s.adjustedValueOmr).toBe(121000);
    expect(s.confidence).toBe("medium"); // 3 comps, tight spread
    expect(s.notes.some((n) => n.includes("ASKING"))).toBe(true);
  });

  it("prefers transaction price over asking and says so", () => {
    const comps = [
      comp({ reference: "A", askingPriceOmr: 110000, transactionPriceOmr: 100000 }),
      comp({ reference: "B", askingPriceOmr: 105000 }),
    ];
    const s = summarizeComparables(comps, { areaSqm: 100, priceOmr: 100000 });
    // A counts at its transaction price 100000, B at asking 105000
    expect(s.medianPriceOmr).toBe(102500);
    expect(s.notes.some((n) => n.includes("1 of 2"))).toBe(true);
  });

  it("derives the yield range from comps carrying both price and rent", () => {
    const comps = [
      comp({ reference: "A", askingPriceOmr: 100000, annualRentOmr: 7000 }), // 7%
      comp({ reference: "B", askingPriceOmr: 100000, monthlyRentOmr: 500 }), // 6%
      comp({ reference: "C", askingPriceOmr: 100000 }), // no rent — excluded
    ];
    const s = summarizeComparables(comps, { areaSqm: 100, priceOmr: 100000 });
    expect(s.yieldRange).toEqual({ minPct: 6, maxPct: 7, medianPct: 6.5 });
  });

  it("fewer than 2 usable comps → insufficient, with a warning note", () => {
    const s = summarizeComparables([comp({ askingPriceOmr: 100000 })], {
      areaSqm: 100,
      priceOmr: 90000,
    });
    expect(s.confidence).toBe("insufficient");
    expect(s.notes.some((n) => n.includes("Fewer than 2"))).toBe(true);
  });

  it("wide dispersion downgrades confidence and adds a note", () => {
    const comps = [
      comp({ reference: "A", areaSqm: 100, askingPriceOmr: 60000 }), // 600/m²
      comp({ reference: "B", areaSqm: 100, askingPriceOmr: 100000 }), // 1000/m²
      comp({ reference: "C", areaSqm: 100, askingPriceOmr: 160000 }), // 1600/m²
    ];
    const s = summarizeComparables(comps, { areaSqm: 100, priceOmr: 100000 });
    expect(s.confidence).toBe("low");
    expect(s.notes.some((n) => n.includes("dispersion"))).toBe(true);
  });

  it("comps without price or area never poison the statistics", () => {
    const comps = [
      comp({ reference: "A", askingPriceOmr: 100000 }),
      comp({ reference: "B", askingPriceOmr: null, areaSqm: 0 }),
      comp({ reference: "C", askingPriceOmr: 104000 }),
    ];
    const s = summarizeComparables(comps, { areaSqm: 100, priceOmr: 100000 });
    expect(s.count).toBe(3); // reported…
    expect(s.medianPriceOmr).toBe(102000); // …but only usable comps counted
  });
});

describe("haversineKm", () => {
  it("measures Muscat → Seeb airport at roughly 10 km", () => {
    const km = haversineKm({ lat: 23.588, lng: 58.383 }, { lat: 23.593, lng: 58.284 });
    expect(km).toBeGreaterThan(9.5);
    expect(km).toBeLessThan(10.8);
  });

  it("zero distance for identical points", () => {
    expect(haversineKm({ lat: 23.6, lng: 58.4 }, { lat: 23.6, lng: 58.4 })).toBe(0);
  });
});
