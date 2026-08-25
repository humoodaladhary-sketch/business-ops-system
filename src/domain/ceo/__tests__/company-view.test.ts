// The company view: where the month stands, where it lands, and the honest
// answer when there is nothing to say.
import { describe, expect, it } from "vitest";

import { formatOmr } from "../baisa";
import { companyAsOf, companyMonthState, earliestMeasurementMonth, openProvisions } from "../company";
import { companyKeepRate } from "../deals";
import { AS_OF, dataset } from "./fixtures";

describe("the month state", () => {
  const state = () => {
    const { people, deals, costPolicies, settings } = dataset();
    return companyMonthState(
      people, deals, "2026-08", AS_OF, costPolicies, settings, companyKeepRate(deals),
    );
  };

  it("reports the month's volume against a break-even it has to clear", () => {
    const s = state();
    expect(formatOmr(s.volumeBaisa, { decimals: 0 })).toBe("94,500");
    expect(s.breakEvenVolumeBaisa).not.toBeNull();
    expect(s.projectedVolumeBaisa).not.toBeNull();
  });

  it("says plainly that the month is not on course to cover itself", () => {
    const s = state();
    expect(s.projectedBreakEvenCoverage!).toBeLessThan(1);
  });

  it("carries the unpriced cost gap onto the company view", () => {
    expect(state().unpricedCostItems).toBe(7);
  });

  it("suppresses projection at the start of a month instead of inventing one", () => {
    const { people, deals, costPolicies, settings } = dataset();
    const s = companyMonthState(
      people, deals, "2026-08", "2026-08-02", costPolicies, settings, companyKeepRate(deals),
    );
    expect(s.pace.measurable).toBe(false);
    expect(s.projectedVolumeBaisa).toBeNull();
    expect(s.projectedBreakEvenCoverage).toBeNull();
    expect(s.paceIndexVsBreakEven).toBeNull();
  });

  it("returns no break-even at all when there is no keep rate to divide by", () => {
    const { people, deals, costPolicies, settings } = dataset();
    const s = companyMonthState(people, deals, "2026-08", AS_OF, costPolicies, settings, null);
    expect(s.breakEvenVolumeBaisa).toBeNull();
    expect(s.projectedBreakEvenCoverage).toBeNull();
  });
});

describe("the whole dataset in one call", () => {
  it("assembles the company view from the measurement baseline to today", () => {
    const view = companyAsOf(dataset(), AS_OF);
    expect(view.window).toEqual({ from: "2026-01", to: "2026-08" });
    expect(view.summary.deals.count).toBe(38);
    expect(view.month.month).toBe("2026-08");
    expect(view.standings).toHaveLength(12);
    expect(view.provisions).toHaveLength(1);
  });

  it("starts the window at the earliest measurement baseline", () => {
    expect(earliestMeasurementMonth(dataset().people)).toBe("2026-01");
  });
});

describe("provisions", () => {
  it("surfaces only what is still open", () => {
    const provisions = [
      ...dataset().provisions,
      { ...dataset().provisions[0], id: "settled", status: "settled" as const },
    ];
    expect(openProvisions(provisions).map((p) => p.id)).toEqual(["retroactive-social-insurance"]);
  });
});
