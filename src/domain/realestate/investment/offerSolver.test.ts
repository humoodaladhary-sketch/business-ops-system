import { describe, it, expect } from "vitest";
import { solveOffer, type PricePointMetrics } from "./offerSolver";

/** Simple deterministic deal: NOI 7000, gross 9000, cash = 25% of price + 2000. */
function evaluate(priceOmr: number): PricePointMetrics {
  return {
    grossYieldPct: priceOmr > 0 ? (9000 / priceOmr) * 100 : null,
    netYieldPct: priceOmr > 0 ? (7000 / priceOmr) * 100 : null,
    capRatePct: priceOmr > 0 ? (7000 / priceOmr) * 100 : null,
    cashOnCashPct: (() => {
      const cash = priceOmr * 0.25 + 2000;
      return cash > 0 ? (3000 / cash) * 100 : null;
    })(),
    irrPct: priceOmr > 0 ? (7000 / priceOmr) * 100 + 2 : null, // monotone stand-in
    monthlyCashFlowOmr: 7000 / 12 - priceOmr * 0.002, // falls with price
    totalCashRequiredOmr: priceOmr * 0.25 + 2000,
  };
}

describe("solveOffer", () => {
  it("solves a closed-form-checkable gross-yield target by bisection", () => {
    const r = solveOffer({
      askingPriceOmr: 160000,
      targets: [{ key: "grossYield", value: 6 }],
      evaluate,
    });
    // 9000 / p ≥ 6% → p ≤ 150000
    const t = r.perTarget[0];
    expect(t.maxPriceOmr).not.toBeNull();
    expect(Math.abs((t.maxPriceOmr as number) - 150000)).toBeLessThanOrEqual(100);
    expect(r.maximumJustifiedPriceOmr).toBe(t.maxPriceOmr);
    // discount vs asking ≈ 10000 OMR ≈ 6.25%
    expect(r.discountRequiredOmr).toBeGreaterThanOrEqual(9900);
    expect(r.discountRequiredPct).toBeGreaterThan(6);
  });

  it("affordability caps price by the cash budget", () => {
    const r = solveOffer({
      askingPriceOmr: 200000,
      targets: [{ key: "affordability", value: 40000 }],
      evaluate,
    });
    // 0.25p + 2000 ≤ 40000 → p ≤ 152000
    expect(Math.abs((r.perTarget[0].maxPriceOmr as number) - 152000)).toBeLessThanOrEqual(100);
  });

  it("the justified price is the MINIMUM across all targets", () => {
    const r = solveOffer({
      askingPriceOmr: 160000,
      targets: [
        { key: "grossYield", value: 6 }, // → ~150000
        { key: "netYield", value: 5 }, // → 7000/0.05 = ~140000
      ],
      evaluate,
    });
    expect(Math.abs((r.maximumJustifiedPriceOmr as number) - 140000)).toBeLessThanOrEqual(100);
  });

  it("opening offer sits the margin below justified; range and walk-away follow", () => {
    const r = solveOffer({
      askingPriceOmr: 160000,
      targets: [{ key: "netYield", value: 5 }],
      evaluate,
      openingMarginPct: 5,
    });
    const justified = r.maximumJustifiedPriceOmr as number;
    const opening = r.suggestedOpeningOfferOmr as number;
    expect(opening).toBeLessThan(justified);
    expect(opening).toBeGreaterThanOrEqual(justified * 0.94);
    expect(r.suggestedRange).toEqual({ minimumOmr: opening, maximumOmr: justified });
    expect(r.walkAwayPriceOmr).toBe(justified);
  });

  it("unreachable targets yield null (no invented price)", () => {
    const r = solveOffer({
      askingPriceOmr: 160000,
      targets: [{ key: "grossYield", value: 200 }], // impossible
      evaluate,
    });
    expect(r.perTarget[0].maxPriceOmr).toBeNull();
    expect(r.maximumJustifiedPriceOmr).toBeNull();
    expect(r.suggestedRange).toBeNull();
    expect(r.discountRequiredOmr).toBeNull();
  });

  it("metricsAt covers asking, negotiated and the solved points", () => {
    const r = solveOffer({
      askingPriceOmr: 160000,
      negotiatedPriceOmr: 155000,
      targets: [{ key: "grossYield", value: 6 }],
      evaluate,
    });
    const labels = r.metricsAt.map((m) => m.label);
    expect(labels).toContain("Asking price");
    expect(labels).toContain("Negotiated price");
    expect(labels).toContain("Maximum justified");
    expect(labels).toContain("Opening offer");
  });

  it("labels every output as analytical, not a valuation", () => {
    const r = solveOffer({ askingPriceOmr: 100000, targets: [], evaluate });
    expect(r.disclaimer).toContain("not a market valuation");
    expect(r.maximumJustifiedPriceOmr).toBeNull(); // no targets → no invented price
  });
});
