import { describe, it, expect } from "vitest";
import { acquisitionCosts } from "./acquisition";

describe("acquisitionCosts", () => {
  it("totals price + itemized costs + contingency and derives cash/equity", () => {
    const r = acquisitionCosts({
      priceOmr: 100000,
      costLines: [
        { key: "registration", label: "Registration fee", amountOmr: 3000 },
        { key: "legal", label: "Legal fees", amountOmr: 500 },
        { key: "furnishing", label: "Furnishing", amountOmr: 2000 },
      ],
      contingencyPct: 10,
      financedOmr: 60000,
      areaSqm: 100,
    });
    expect(r.itemizedCostsOmr).toBe(5500);
    expect(r.contingencyOmr).toBe(550);
    expect(r.totalAcquisitionCostOmr).toBe(106050);
    expect(r.totalCashRequiredOmr).toBe(46050); // 106050 − 60000
    expect(r.acquisitionCostPct).toBe(6.05); // 6050 / 100000
    expect(r.costPerSqmOmr).toBe(1060.5);
    expect(r.pricePerSqmOmr).toBe(1000);
    expect(r.initialEquityOmr).toBe(40000); // price − loan
    // contingency appended as a display line
    expect(r.lines.find((l) => l.key === "contingency")?.amountOmr).toBe(550);
  });

  it("all-cash with no costs: cash required equals price", () => {
    const r = acquisitionCosts({ priceOmr: 80000, costLines: [] });
    expect(r.itemizedCostsOmr).toBe(0);
    expect(r.totalAcquisitionCostOmr).toBe(80000);
    expect(r.totalCashRequiredOmr).toBe(80000);
    expect(r.acquisitionCostPct).toBe(0);
  });

  it("guards zero price and missing area with null, never fake zeroes-as-ratios", () => {
    const r = acquisitionCosts({
      priceOmr: 0,
      costLines: [{ key: "legal", label: "Legal", amountOmr: 500 }],
    });
    expect(r.acquisitionCostPct).toBeNull();
    expect(r.costPerSqmOmr).toBeNull();
    expect(r.pricePerSqmOmr).toBeNull();
    expect(r.totalAcquisitionCostOmr).toBe(500);
  });

  it("floors cash required at 0 when financing exceeds total cost", () => {
    const r = acquisitionCosts({ priceOmr: 50000, costLines: [], financedOmr: 60000 });
    expect(r.totalCashRequiredOmr).toBe(0);
    expect(r.initialEquityOmr).toBe(-10000); // over-financing stays visible
  });

  it("zero-value cost lines are kept (they document what was considered)", () => {
    const r = acquisitionCosts({
      priceOmr: 50000,
      costLines: [{ key: "agency", label: "Agency fee", amountOmr: 0 }],
    });
    expect(r.lines).toHaveLength(1);
    expect(r.itemizedCostsOmr).toBe(0);
  });
});
