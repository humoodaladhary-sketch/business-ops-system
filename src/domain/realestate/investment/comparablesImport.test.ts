import { describe, it, expect } from "vitest";
import { parseComparables } from "./comparablesImport";

describe("parseComparables — CSV", () => {
  it("parses a header row with alias columns and typed values", () => {
    const csv = [
      "Ref,Project,Beds,Area,Asking Price,Annual Rent,Source,Provenance",
      "C-1,Al Mouj,2,118,\"142,000\",11500,Portal listing 2026-07,observed",
      "C-2,Al Mouj,1,76,88000,,Portal listing 2026-07,",
    ].join("\n");
    const { comps, errors } = parseComparables(csv, "manual paste");
    expect(errors).toEqual([]);
    expect(comps).toHaveLength(2);
    expect(comps[0]).toMatchObject({
      reference: "C-1",
      project: "Al Mouj",
      bedrooms: 2,
      areaSqm: 118,
      askingPriceOmr: 142000, // thousands separator handled
      annualRentOmr: 11500,
      dataSource: "Portal listing 2026-07",
      provenance: "observed",
    });
    // Unstated provenance defaults to estimated, never observed
    expect(comps[1].provenance).toBe("estimated");
    expect(comps[1].annualRentOmr).toBeNull();
  });

  it("rejects rows missing essentials with a reason instead of guessing", () => {
    const csv = ["reference,project,areaSqm", "C-1,Al Mouj,", ",Al Mouj,100", "C-3,,100"].join("\n");
    const { comps, errors } = parseComparables(csv, "paste");
    expect(comps).toHaveLength(0);
    expect(errors).toEqual([
      "row 1: missing areaSqm",
      "row 2: missing reference",
      "row 3: missing project",
    ]);
  });

  it("requires a reference column in the header", () => {
    const { comps, errors } = parseComparables("project,areaSqm\nAl Mouj,100", "paste");
    expect(comps).toHaveLength(0);
    expect(errors[0]).toContain("reference column");
  });

  it("applies the fallback source when a row states none", () => {
    const csv = "reference,project,areaSqm,askingPrice\nC-1,Al Mouj,100,90000";
    const { comps } = parseComparables(csv, "pasted by owner 2026-08-02");
    expect(comps[0].dataSource).toBe("pasted by owner 2026-08-02");
  });
});

describe("parseComparables — JSON", () => {
  it("parses an array of objects with alias keys", () => {
    const json = JSON.stringify([
      { ref: "J-1", community: "Muscat Bay", area: 95, price: "120000", monthlyRent: 550, provenance: "observed", source: "Owner statement" },
    ]);
    const { comps, errors } = parseComparables(json, "paste");
    expect(errors).toEqual([]);
    expect(comps[0]).toMatchObject({
      reference: "J-1",
      project: "Muscat Bay",
      areaSqm: 95,
      askingPriceOmr: 120000,
      monthlyRentOmr: 550,
      dataSource: "Owner statement",
    });
  });

  it("flags invalid JSON and non-object rows", () => {
    expect(parseComparables("[{", "p").errors).toEqual(["invalid JSON"]);
    const { errors } = parseComparables('[42, {"ref":"a","project":"b","area":10}]', "p");
    expect(errors).toEqual(["row 1: not an object"]);
  });

  it("empty input imports nothing", () => {
    expect(parseComparables("   ", "p")).toEqual({ comps: [], errors: ["nothing to import"] });
  });
});
