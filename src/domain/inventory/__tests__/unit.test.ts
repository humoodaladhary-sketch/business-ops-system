import { describe, expect, it } from "vitest";
import {
  deriveId,
  derivePricePerSqm,
  parseUnitRows,
  slugify,
  UnitDraftSchema,
} from "../unit";

describe("slugify / deriveId", () => {
  it("slugifies messy project + unitRef into a stable id", () => {
    expect(slugify("Sultan Haitham City — Phase 1")).toBe("sultan-haitham-city-phase-1");
    expect(deriveId("AIDA", "B-2214")).toBe("aida|b-2214");
  });

  it("is stable across whitespace/case differences", () => {
    expect(deriveId("  AIDA ", "b-2214")).toBe(deriveId("AIDA", "B-2214"));
  });
});

describe("derivePricePerSqm", () => {
  it("computes rounded price per sqm", () => {
    expect(derivePricePerSqm(108_500, 96)).toBe(1130);
  });
  it("returns null when inputs are missing or zero", () => {
    expect(derivePricePerSqm(null, 96)).toBeNull();
    expect(derivePricePerSqm(108_500, null)).toBeNull();
    expect(derivePricePerSqm(108_500, 0)).toBeNull();
  });
});

describe("UnitDraftSchema coercion", () => {
  it("parses messy price/size strings into numbers", () => {
    const parsed = UnitDraftSchema.parse({
      project: "AIDA",
      developer: null,
      unitRef: "B-1",
      unitType: "2BR",
      bedrooms: "2",
      bathrooms: null,
      sizeSqm: "96 sqm",
      floor: null,
      view: null,
      priceOMR: "OMR 108,500",
      status: "AVAILABLE",
      paymentPlan: null,
      handoverDate: null,
      itcEligible: "yes",
      furnishing: "",
      notes: null,
      sourceRaw: "raw",
    });
    expect(parsed.priceOMR).toBe(108_500);
    expect(parsed.sizeSqm).toBe(96);
    expect(parsed.bedrooms).toBe(2);
    expect(parsed.status).toBe("available");
    expect(parsed.itcEligible).toBe(true);
    expect(parsed.developer).toBe("Unknown developer");
    expect(parsed.furnishing).toBeNull();
  });

  it("defaults itcEligible to true when absent, false when negated", () => {
    expect(UnitDraftSchema.parse({ project: "p", unitRef: "r", unitType: "studio" }).itcEligible).toBe(true);
    expect(
      UnitDraftSchema.parse({ project: "p", unitRef: "r", unitType: "studio", itcEligible: "no" }).itcEligible,
    ).toBe(false);
  });
});

describe("parseUnitRows", () => {
  it("validates good rows and reports bad ones without throwing", () => {
    const { units, errors } = parseUnitRows([
      { project: "AIDA", unitRef: "B-1", unitType: "2BR", priceOMR: "120000", sizeSqm: "100" },
      { project: "", unitRef: "B-2", unitType: "2BR" }, // invalid: empty project
      { project: "AIDA", unitRef: "B-3", unitType: "not-a-type" }, // invalid enum
    ]);
    expect(units).toHaveLength(1);
    expect(units[0].id).toBe("aida|b-1");
    expect(units[0].pricePerSqm).toBe(1200);
    expect(errors).toHaveLength(2);
    expect(errors[0].index).toBe(1);
  });

  it("handles empty input", () => {
    expect(parseUnitRows([])).toEqual({ units: [], errors: [] });
  });

  it("drops a row whose derived price is non-positive", () => {
    const { units, errors } = parseUnitRows([
      { project: "AIDA", unitRef: "B-1", unitType: "studio", priceOMR: "-5" },
    ]);
    expect(units).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
