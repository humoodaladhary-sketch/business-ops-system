import { describe, it, expect } from "vitest";
import { lastDeltaPct, monthlySeries, summarizeFunnel } from "./funnel";

describe("summarizeFunnel", () => {
  it("builds a cumulative funnel with conversion percentages", () => {
    const leads = [
      { stage: "NEW" },
      { stage: "QUALIFIED" },
      { stage: "ENGAGED" },
      { stage: "VIEWING" },
      { stage: "VIEWING" },
      { stage: "NEGOTIATION" },
      { stage: "RESERVATION" },
      { stage: "CLOSED_WON" },
    ];
    const f = summarizeFunnel(leads);
    // Cumulative: leads 8, viewing 5, negotiation 3, reservation 2, closed 1
    expect(f.steps.map((s) => s.count)).toEqual([8, 5, 3, 2, 1]);
    expect(f.steps[1].conversionPct).toBe(63); // 5/8
    expect(f.steps[4].conversionPct).toBe(50); // 1/2
    expect(f.totalOpen).toBe(7);
  });

  it("names the worst conversion step as the bottleneck", () => {
    const f = summarizeFunnel([
      { stage: "NEW" },
      { stage: "NEW" },
      { stage: "NEW" },
      { stage: "NEW" },
      { stage: "VIEWING" },
      { stage: "RESERVATION" },
      { stage: "CLOSED_WON" },
    ]);
    // Cumulative: 7 → 3 → 2 → 2 → 1. viewing 43% is the worst measured drop
    // (negotiation 67%, reservation 100%, closed 50%).
    expect(f.bottleneckKey).toBe("viewing");
    // With zero closings the bottleneck honestly moves to the close step:
    const noClose = summarizeFunnel([{ stage: "NEW" }, { stage: "RESERVATION" }]);
    expect(noClose.bottleneckKey).toBe("closed"); // 0/1 closed
  });

  it("never guesses how far unknown or lost rows progressed", () => {
    const f = summarizeFunnel([{ stage: "CLOSED_LOST" }, { stage: "SOMETHING_ELSE" }]);
    expect(f.steps.every((s) => s.count === 0)).toBe(true);
    expect(f.bottleneckKey).toBeNull();
    expect(f.totalOpen).toBe(1); // the unknown stage is open; CLOSED_LOST is not
  });

  it("stage matching is case-insensitive (dashboards send uppercase, DB lowercase)", () => {
    const f = summarizeFunnel([{ stage: "viewing" }, { stage: "Reservation" }]);
    expect(f.steps.map((s) => s.count)).toEqual([2, 2, 1, 1, 0]);
  });
});

describe("monthlySeries", () => {
  it("zero-fills trailing months and sums per period", () => {
    const rows = [
      { period: "2026-07", value: 100 },
      { period: "2026-07", value: 50 },
      { period: "2026-05", value: 30 },
      { period: "2020-01", value: 999 }, // out of window
      { period: null, value: 999 },
    ];
    const s = monthlySeries(rows, "2026-08", 4);
    expect(s).toEqual([
      { period: "2026-05", value: 30 },
      { period: "2026-06", value: 0 },
      { period: "2026-07", value: 150 },
      { period: "2026-08", value: 0 },
    ]);
  });

  it("handles year boundaries", () => {
    const s = monthlySeries([{ period: "2025-12", value: 10 }], "2026-01", 2);
    expect(s.map((p) => p.period)).toEqual(["2025-12", "2026-01"]);
  });

  it("lastDeltaPct compares the final two points and guards zero", () => {
    expect(
      lastDeltaPct([
        { period: "a", value: 100 },
        { period: "b", value: 130 },
      ]),
    ).toBe(30);
    expect(
      lastDeltaPct([
        { period: "a", value: 0 },
        { period: "b", value: 100 },
      ]),
    ).toBeNull();
    expect(lastDeltaPct([{ period: "a", value: 5 }])).toBeNull();
  });
});
