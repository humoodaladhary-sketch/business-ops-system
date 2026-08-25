// Regressions from the audit of the calc layer. Each of these was a real defect
// found by probing the parts the acceptance test does not reach; each is locked
// here so it cannot return.
import { describe, expect, it } from "vitest";

import { formatOmr } from "../baisa";
import {
  agentCutAnomalies,
  awaitingCollection,
  awaitingInvoice,
  companyNet,
  expectedAgentAmount,
  netReconciliationDelta,
  totalsOf,
} from "../deals";
import { bandFor, isBonusEligible, monthPerformance } from "../person";
import { AS_OF, dataset, personById } from "./fixtures";

describe("the referral comes off the top before the advisor's cut", () => {
  it.each([
    { ref: "HUM-0004", expected: "984.600" },
    { ref: "HUM-0005", expected: "542.500" },
  ])("$ref: the cut is taken on gross minus referral", ({ ref, expected }) => {
    const deal = dataset().deals.find((d) => d.ref === ref)!;
    expect(deal.referralBaisa).toBeGreaterThan(0);
    expect(formatOmr(expectedAgentAmount(deal))).toBe(expected);
    // ...and that is exactly what the sheet recorded, so it is not an anomaly.
    expect(expectedAgentAmount(deal)).toBe(deal.agentAmountBaisa);
  });

  it("would have flagged both referral deals as errors if the cut were on gross", () => {
    const deal = dataset().deals.find((d) => d.ref === "HUM-0004")!;
    const onGross = Math.round((deal.grossCommissionBaisa * deal.agentCutPct) / 100);
    expect(onGross).not.toBe(deal.agentAmountBaisa);
    expect(onGross).toBe(deal.agentAmountBaisa * 2);
  });
});

describe("agent-cut anomalies in the source sheet", () => {
  it("reports exactly Alex's two mis-cut deals, and nothing else", () => {
    const anomalies = agentCutAnomalies(dataset().deals);
    expect(anomalies.map((a) => a.deal.ref).sort()).toEqual(["ALE-0002", "ALE-0003"]);
  });

  it("prices the discrepancy at 58.416 OMR of under-paid advisor cut", () => {
    const total = agentCutAnomalies(dataset().deals).reduce((s, a) => s + a.differenceBaisa, 0);
    expect(formatOmr(total)).toBe("58.416");
  });

  it("does not correct the published figures — recorded amounts are what was paid", () => {
    const { deals } = dataset();
    // companyNet still uses the recorded cut, so the verified table is untouched.
    expect(totalsOf(deals).companyNetBaisa).toBe(69_556_093);
    expect(companyNet(deals.find((d) => d.ref === "ALE-0003")!)).toBe(1_685_333);
  });

  it("reports per-deal drift between the sheet's net column and the formula", () => {
    const { deals } = dataset();
    const drifting = deals.filter((d) => netReconciliationDelta(d) !== 0);
    // Every divergence is exactly one baisa in either direction — float rounding,
    // not a substantive disagreement about what a deal earned.
    expect(drifting.every((d) => Math.abs(netReconciliationDelta(d)) === 1)).toBe(true);
    expect(deals.reduce((s, d) => s + netReconciliationDelta(d), 0)).toBe(2);
  });

  it("tolerates the sheet's one-baisa float drift rather than crying wolf", () => {
    // SHA-0002 and friends are off by exactly one baisa from binary rounding.
    const strict = agentCutAnomalies(dataset().deals, { toleranceBaisa: 0 });
    expect(strict.length).toBeGreaterThan(agentCutAnomalies(dataset().deals).length);
    expect(strict.map((a) => a.deal.ref)).toContain("SHA-0002");
  });
});

describe("the cash-gap tick-lists", () => {
  it("never lists an already-collected deal as awaiting an invoice", () => {
    const { deals } = dataset();
    // HUM-0004 is collected with its invoicing state never recorded.
    const hum4 = deals.find((d) => d.ref === "HUM-0004")!;
    expect(hum4.collected).toBe("yes");
    expect(hum4.invoiced).toBe("unknown");

    expect(awaitingInvoice(deals).map((d) => d.ref)).not.toContain("HUM-0004");
  });

  it("still lists deals that are genuinely uninvoiced or unknown", () => {
    const refs = awaitingInvoice(dataset().deals).map((d) => d.ref);
    expect(refs).toContain("SHA-0019"); // invoiced: no
    expect(refs).toContain("HUM-0002"); // invoiced: unknown, not collected
  });

  it("keeps the two stages disjoint", () => {
    const { deals } = dataset();
    const invoicing = new Set(awaitingInvoice(deals).map((d) => d.ref));
    const collecting = awaitingCollection(deals).map((d) => d.ref);
    expect(collecting.filter((r) => invoicing.has(r))).toEqual([]);
  });
});

describe("the bonus scheme stops at advisors", () => {
  it("does not measure the founder against the advisor target or bands", () => {
    const { deals, costPolicies, settings } = dataset();
    // July is the founder's biggest month — 415,540 of volume.
    const card = monthPerformance(personById("humood"), deals, "2026-07", AS_OF, costPolicies, settings);

    expect(isBonusEligible(personById("humood"))).toBe(false);
    expect(card.bonusEligible).toBe(false);
    expect(card.targetBaisa).toBeNull();
    expect(card.paceIndex).toBeNull();
    expect(card.currentBand).toBeNull();
    expect(card.projectedBand).toBeNull();

    // His own volume is still shown — he sells, and the brief says show it.
    expect(card.volumeBaisa).toBeGreaterThan(0);
    expect(card.projectedVolumeBaisa).not.toBeNull();
    expect(card.deals?.count).toBe(2);
  });

  it("still measures an advisor against both", () => {
    const { deals, costPolicies, settings } = dataset();
    const card = monthPerformance(personById("shatha"), deals, "2026-02", AS_OF, costPolicies, settings);

    expect(card.bonusEligible).toBe(true);
    expect(card.targetBaisa).toBe(250_000_000);
    expect(card.currentBand?.id).toBe("outstanding");
    expect(card.paceIndex).not.toBeNull();
  });

  it("gives support staff neither, as before", () => {
    const { deals, costPolicies, settings } = dataset();
    const card = monthPerformance(personById("abeer"), deals, "2026-08", AS_OF, costPolicies, settings);
    expect(card.bonusEligible).toBe(false);
    expect(card.volumeBaisa).toBeNull();
  });
});

describe("bonus bands cover every volume", () => {
  it("puts a negative month in the lowest band rather than in no band at all", () => {
    const bands = dataset().settings.bonusBands;
    const band = bandFor(-50_000_000, bands);
    expect(band?.id).toBe("below");
    expect(band?.bonusBaisa).toBe(0);
  });

  it("returns null only when there are no bands configured", () => {
    expect(bandFor(1_000, [])).toBeNull();
  });
});
