import { describe, it, expect } from "vitest";
import { buildOffer, offerToMarkdown, isGccNationality, type OfferInput } from "./offer";

function baseInput(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    clientName: "Test Client",
    nationality: "British",
    goal: "Golden Residency + ROI",
    budgetOmr: 300000,
    unit: {
      reference: "AM-1203",
      project: "Al Mouj",
      developer: "Al Mouj Muscat",
      unitType: "2BR Apartment",
      areaSqm: 120,
      priceOmr: 240000,
      category: "ITC",
      ownershipEligibility: "all_nationalities",
    },
    ...overrides,
  };
}

describe("isGccNationality", () => {
  it("accepts names, adjectivals and ISO codes, case-insensitively", () => {
    expect(isGccNationality("Oman")).toBe(true);
    expect(isGccNationality("omani")).toBe(true);
    expect(isGccNationality("KSA")).toBe(true);
    expect(isGccNationality("Saudi Arabia")).toBe(true);
    expect(isGccNationality("U.A.E.")).toBe(true);
    expect(isGccNationality("Qatari")).toBe(true);
    expect(isGccNationality("bh")).toBe(true);
  });

  it("rejects non-GCC nationalities", () => {
    expect(isGccNationality("British")).toBe(false);
    expect(isGccNationality("Indian")).toBe(false);
    expect(isGccNationality("USA")).toBe(false);
  });
});

describe("buildOffer eligibility", () => {
  it("non-GCC client + gcc_omani_only unit => ok:false and steers to ITC", () => {
    const offer = buildOffer(
      baseInput({
        nationality: "British",
        unit: { ...baseInput().unit, ownershipEligibility: "gcc_omani_only" },
      }),
    );
    expect(offer.eligibility.ok).toBe(false);
    expect(offer.eligibility.reason).toMatch(/ITC/);
  });

  it("GCC client + gcc_omani_only unit => ok:true", () => {
    const offer = buildOffer(
      baseInput({
        nationality: "Omani",
        unit: { ...baseInput().unit, ownershipEligibility: "gcc_omani_only" },
      }),
    );
    expect(offer.eligibility.ok).toBe(true);
  });

  it("all_nationalities unit is eligible for any nationality", () => {
    expect(buildOffer(baseInput({ nationality: "British" })).eligibility.ok).toBe(true);
    expect(buildOffer(baseInput({ nationality: "Indian" })).eligibility.ok).toBe(true);
  });
});

describe("buildOffer composition", () => {
  it("computes price per m² and residency tier", () => {
    const offer = buildOffer(baseInput());
    expect(offer.pricePerSqmOmr).toBe(2000); // 240000 / 120
    expect(offer.residency.tier).toBe("golden_10yr");
    expect(offer.validityDays).toBe(7);
    // payment plan reconciles to price
    const total =
      Math.round(offer.paymentPlan.schedule.reduce((a, s) => a + s.amountOmr, 0) * 1000) / 1000;
    expect(total).toBe(240000);
  });
});

describe("reservation offer", () => {
  it("applies ONLY when closingToday AND reservationOffer are both true", () => {
    const on = buildOffer(baseInput({ closingToday: true, reservationOffer: true }));
    expect(on.reservationOffer.applies).toBe(true);
    expect(on.reservationOffer.amountOmr).toBe(500);
    expect(on.reservationOffer.condition).toBe("Reserve today");
    // the 500 OMR reservation is folded into the payment plan
    expect(on.paymentPlan.reservationOmr).toBe(500);
    expect(on.paymentPlan.schedule[0].label).toBe("Reservation");
  });

  it("does NOT apply when only one flag is set, or neither", () => {
    expect(buildOffer(baseInput({ closingToday: true })).reservationOffer.applies).toBe(false);
    expect(buildOffer(baseInput({ reservationOffer: true })).reservationOffer.applies).toBe(false);
    expect(buildOffer(baseInput()).reservationOffer.applies).toBe(false);
    // no reservation folded into the plan
    expect(buildOffer(baseInput({ closingToday: true })).paymentPlan.reservationOmr).toBe(0);
  });
});

describe("offerToMarkdown", () => {
  it("renders a client-ready offer in OMR + m² with a payment table", () => {
    const md = offerToMarkdown(buildOffer(baseInput({ closingToday: true, reservationOffer: true })));
    expect(md).toContain("Al Mouj");
    expect(md).toContain("OMR");
    expect(md).toContain("m²");
    expect(md).toContain("| Payment | Due | Amount |");
    expect(md).toContain("Reserve today");
  });

  it("NEVER leaks internal commission figures", () => {
    const md = offerToMarkdown(buildOffer(baseInput()));
    expect(md).not.toMatch(/commission/i);
    expect(md).not.toMatch(/agent\s*share/i);
    expect(md).not.toMatch(/alwalaaGross/i);
  });
});
