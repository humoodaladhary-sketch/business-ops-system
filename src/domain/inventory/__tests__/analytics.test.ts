import { describe, expect, it } from "vitest";
import {
  comparisonMatrix,
  computeKpis,
  extremesByCategory,
  priceBandByProject,
  pricePerSqmByProject,
  recentMovements,
  unitTypeDistribution,
} from "../analytics";
import type { Unit } from "../unit";
import type { PriceMovement } from "@/storage/inventory/InventoryRepository";

function makeUnit(overrides: Partial<Unit>): Unit {
  return {
    id: overrides.id ?? `${overrides.project ?? "p"}|${overrides.unitRef ?? "r"}`,
    project: "Project A",
    developer: "Dev",
    unitRef: "R1",
    unitType: "2BR",
    bedrooms: 2,
    bathrooms: 2,
    sizeSqm: 100,
    floor: null,
    view: null,
    priceOMR: 100_000,
    pricePerSqm: 1000,
    status: "available",
    paymentPlan: null,
    handoverDate: null,
    itcEligible: true,
    furnishing: null,
    sourceRaw: "",
    importedAt: "2026-01-01T00:00:00.000Z",
    notes: null,
    ...overrides,
  };
}

describe("computeKpis", () => {
  it("handles empty input", () => {
    expect(computeKpis([])).toEqual({
      totalUnits: 0,
      totalValueOMR: 0,
      avgPricePerSqm: null,
      projectCount: 0,
      availableCount: 0,
    });
  });

  it("skips null prices in totals and averages", () => {
    const units = [
      makeUnit({ unitRef: "A", priceOMR: 100_000, pricePerSqm: 1000 }),
      makeUnit({ unitRef: "B", priceOMR: null, pricePerSqm: null }),
      makeUnit({ unitRef: "C", priceOMR: 200_000, pricePerSqm: 2000, status: "sold" }),
    ];
    const k = computeKpis(units);
    expect(k.totalUnits).toBe(3);
    expect(k.totalValueOMR).toBe(300_000);
    expect(k.avgPricePerSqm).toBe(1500);
    expect(k.availableCount).toBe(2);
    expect(k.projectCount).toBe(1);
  });
});

describe("extremesByCategory", () => {
  it("single-unit category has zero spread", () => {
    const res = extremesByCategory([makeUnit({ unitRef: "A", priceOMR: 100_000 })], "project");
    expect(res).toHaveLength(1);
    expect(res[0].spreadPct).toBe(0);
    expect(res[0].minUnitRef).toBe("A");
    expect(res[0].maxUnitRef).toBe("A");
  });

  it("computes min/max refs and spread across a category", () => {
    const units = [
      makeUnit({ unitRef: "LOW", priceOMR: 100_000 }),
      makeUnit({ unitRef: "HIGH", priceOMR: 150_000 }),
    ];
    const [row] = extremesByCategory(units, "project");
    expect(row.minUnitRef).toBe("LOW");
    expect(row.maxUnitRef).toBe("HIGH");
    expect(row.spreadPct).toBe(50);
  });

  it("returns null extremes when a category has no priced units", () => {
    const [row] = extremesByCategory([makeUnit({ unitRef: "A", priceOMR: null })], "unitType");
    expect(row.minPriceOMR).toBeNull();
    expect(row.spreadPct).toBeNull();
    expect(row.count).toBe(1);
  });
});

describe("price bands & per-sqm", () => {
  it("priceBandByProject computes min/avg/max", () => {
    const units = [
      makeUnit({ project: "A", unitRef: "1", priceOMR: 100_000 }),
      makeUnit({ project: "A", unitRef: "2", priceOMR: 200_000 }),
    ];
    const [band] = priceBandByProject(units);
    expect(band).toMatchObject({ project: "A", min: 100_000, avg: 150_000, max: 200_000, count: 2 });
  });

  it("pricePerSqmByProject ignores null per-sqm", () => {
    const units = [
      makeUnit({ project: "A", unitRef: "1", pricePerSqm: 1000 }),
      makeUnit({ project: "A", unitRef: "2", pricePerSqm: null }),
    ];
    const [row] = pricePerSqmByProject(units);
    expect(row.avgPricePerSqm).toBe(1000);
    expect(row.count).toBe(1);
  });
});

describe("unitTypeDistribution", () => {
  it("returns empty array for empty input", () => {
    expect(unitTypeDistribution([])).toEqual([]);
  });
  it("computes shares summing to ~100", () => {
    const units = [
      makeUnit({ unitRef: "1", unitType: "studio" }),
      makeUnit({ unitRef: "2", unitType: "2BR" }),
      makeUnit({ unitRef: "3", unitType: "2BR" }),
    ];
    const dist = unitTypeDistribution(units);
    expect(dist[0]).toMatchObject({ unitType: "2BR", count: 2 });
    const totalPct = dist.reduce((a, d) => a + d.pct, 0);
    expect(Math.round(totalPct)).toBe(100);
  });
});

describe("comparisonMatrix", () => {
  it("aggregates per project", () => {
    const units = [
      makeUnit({ project: "A", unitRef: "1", priceOMR: 100_000, pricePerSqm: 1000 }),
      makeUnit({ project: "A", unitRef: "2", priceOMR: 200_000, pricePerSqm: 2000, status: "sold" }),
      makeUnit({ project: "B", unitRef: "3", priceOMR: 300_000, pricePerSqm: 3000 }),
    ];
    const matrix = comparisonMatrix(units);
    expect(matrix).toHaveLength(2);
    const a = matrix.find((m) => m.project === "A")!;
    expect(a.count).toBe(2);
    expect(a.avgPrice).toBe(150_000);
    expect(a.available).toBe(1);
  });
});

describe("recentMovements", () => {
  const mk = (at: string): PriceMovement => ({
    id: "aida|b-1",
    project: "AIDA",
    unitRef: "B-1",
    oldPrice: 100_000,
    newPrice: 110_000,
    deltaPct: 10,
    at,
  });

  it("filters to the window and sorts newest-first", () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 86_400_000).toISOString();
    const old = new Date(now - 60 * 86_400_000).toISOString();
    const res = recentMovements([mk(old), mk(recent)], 30);
    expect(res).toHaveLength(1);
    expect(res[0].at).toBe(recent);
  });

  it("returns empty for non-positive day windows", () => {
    expect(recentMovements([mk(new Date().toISOString())], 0)).toEqual([]);
  });
});
