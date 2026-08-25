import { describe, expect, it } from "vitest";
import { ITC_PROJECTS } from "@/app/_data/itc-zones";
import {
  buildListingBrief,
  listingBriefToPrompt,
  LISTING_PLATFORMS,
  type ListingPlatform,
  type ListingUnitInput,
} from "./listing";
import type { ProjectRef } from "./project-resolver";

const CATALOGUE: readonly ProjectRef[] = ITC_PROJECTS;

function unit(over: Partial<ListingUnitInput> = {}): ListingUnitInput {
  return {
    id: "u-test",
    project: "Al Mouj Muscat",
    developer: "Al Mouj Muscat (MAF)",
    unitType: "Apartment",
    bedrooms: 2,
    priceOMR: 250_000,
    status: "AVAILABLE",
    published: true,
    ...over,
  };
}

function brief(over: Partial<ListingUnitInput> = {}, platform: ListingPlatform = "instagram") {
  return buildListingBrief({ unit: unit(over), platform, language: "en", catalogue: CATALOGUE });
}

/** All prohibitions as one lowercase blob, for substring assertions. */
const prohibitions = (b: ReturnType<typeof brief>) => b.mustNot.join(" | ").toLowerCase();

describe("ITC stock — the foreign-investor angle is unlocked", () => {
  it("permits foreign freehold and the Golden Residency above 200k OMR", () => {
    const b = brief({ priceOMR: 250_000 });
    expect(b.foreignOwnership).toBe(true);
    expect(b.eligibility).toBe("all_nationalities");
    expect(b.facts.join(" ")).toContain("open to buyers of every nationality");
    expect(b.facts.join(" ")).toContain("10-year Golden/Investor Residency");
  });

  it("offers the 2-year tier and explicitly blocks the 10-year claim between 50k and 200k", () => {
    const b = brief({ priceOMR: 120_000 });
    expect(b.foreignOwnership).toBe(true);
    expect(b.facts.join(" ")).toContain("2-year Investor Residency");
    expect(prohibitions(b)).toContain("do not claim the 10-year golden residency");
  });

  it("blocks every residency claim below the 50k threshold", () => {
    const b = brief({ priceOMR: 40_000 });
    expect(b.foreignOwnership).toBe(true);
    expect(prohibitions(b)).toContain("do not mention golden residency");
  });

  it("always attaches the Royal Oman Police disclaimer to a residency claim", () => {
    const b = brief({ priceOMR: 250_000 });
    expect(b.facts.join(" ")).toContain("Royal Oman Police");
  });
});

describe("Future Cities stock — the foreign-investor angle is blocked", () => {
  // Every unit currently in inventory is in this category.
  const wadiZaha = { project: "Wadi Zaha", developer: "Ahly Sabbour", priceOMR: 52_000 };

  it("marks the unit GCC/Omani only", () => {
    const b = brief(wadiZaha);
    expect(b.foreignOwnership).toBe(false);
    expect(b.eligibility).toBe("gcc_omani_only");
    expect(b.facts.join(" ")).toContain("Omani and GCC buyers only");
  });

  it("forbids foreign-ownership, residency and freehold claims", () => {
    const p = prohibitions(brief(wadiZaha));
    expect(p).toContain("do not state or imply that foreigners");
    expect(p).toContain("do not mention golden residency");
    expect(p).toContain("do not use the word 'freehold' unqualified");
    expect(p).toContain("international investors");
  });

  it("does not offer a residency tier even though the price clears 50,000 OMR", () => {
    const b = brief({ ...wadiZaha, priceOMR: 250_000 });
    expect(b.facts.join(" ")).not.toContain("Investor Residency");
    expect(b.facts.join(" ")).not.toContain("Golden");
  });

  it("warns the operator why the angle is unavailable", () => {
    expect(brief(wadiZaha).warnings.join(" ")).toContain("foreign-ownership and residency angles are blocked");
  });

  it("applies the same block to the drifted inventory spellings", () => {
    for (const project of ["Hay Al Wafaa", "Yenaire", "Sarooj Oasis"]) {
      const b = brief({ project });
      expect(b.foreignOwnership).toBe(false);
      expect(b.eligibility).toBe("gcc_omani_only");
    }
  });
});

describe("unconfirmed projects fall back to the restrictive rule", () => {
  it("treats an unmatched project as if it were restricted", () => {
    const b = brief({ project: "Some Tower That Does Not Exist" });
    expect(b.eligibility).toBe("unknown");
    expect(b.foreignOwnership).toBe(false);
    expect(prohibitions(b)).toContain("do not state or imply that foreigners");
  });

  it("tells the operator to fix the project name rather than failing silently", () => {
    const b = brief({ project: "Some Tower That Does Not Exist" });
    expect(b.warnings.join(" ")).toContain("did not match the signed catalogue");
  });

  it("refuses the foreign angle on a merely fuzzy match to a real ITC project", () => {
    const b = brief({ project: "Vistol" });
    expect(b.resolved.confidence).toBe("fuzzy");
    expect(b.resolved.project?.ownershipEligibility).toBe("all_nationalities");
    expect(b.foreignOwnership).toBe(false);
  });
});

describe("availability", () => {
  it("refuses to publish sold stock", () => {
    const b = brief({ status: "SOLD" });
    expect(b.publishable).toBe(false);
    expect(b.blockedReason).toContain("sold");
  });

  it("reframes reserved stock instead of advertising it as available", () => {
    const b = brief({ status: "RESERVED" });
    expect(b.publishable).toBe(true);
    expect(b.facts.join(" ")).toContain("RESERVED");
    expect(prohibitions(b)).toContain("do not describe this unit as available");
  });

  it("flags an unpublished unit without blocking generation", () => {
    const b = brief({ published: false });
    expect(b.publishable).toBe(true);
    expect(b.warnings.join(" ")).toContain("not published to the portal feed");
  });
});

describe("invention guards", () => {
  it("names the fields inventory does not hold and forbids supplying them", () => {
    const b = brief();
    expect(b.unknowns).toContain("handover or completion date");
    expect(b.unknowns).toContain("rental yield, ROI or capital-appreciation figures");
    expect(prohibitions(b)).toContain("do not invent, estimate or imply");
  });

  it("treats missing area as unknown rather than computing a price per m²", () => {
    const b = brief();
    expect(b.pricePerSqmOmr).toBeNull();
    expect(b.unknowns.join(" ")).toContain("floor area");
  });

  it("computes price per m² when an area is actually present", () => {
    const b = brief({ areaSqm: 100, priceOMR: 250_000 });
    expect(b.pricePerSqmOmr).toBe(2500);
    expect(b.unknowns.join(" ")).not.toContain("floor area");
  });

  it("never leaks internal commission data", () => {
    expect(prohibitions(brief())).toContain("do not include internal commission");
  });

  it("quotes USD only as an indicative pegged figure", () => {
    const b = brief({ priceOMR: 250_000 });
    expect(b.priceUsdIndicative).toBe(650_000);
    expect(b.facts.join(" ")).toContain("Indicative USD equivalent");
    expect(prohibitions(b)).toContain("any currency other than omr");
  });
});

describe("platform shaping", () => {
  it("covers every platform in the picker", () => {
    expect(LISTING_PLATFORMS.length).toBeGreaterThanOrEqual(7);
    for (const spec of LISTING_PLATFORMS) {
      const b = brief({}, spec.id);
      expect(b.platform.id).toBe(spec.id);
      expect(b.platform.sections.length).toBeGreaterThan(0);
    }
  });

  it("gives portals no hashtags and forbids contact details in the description", () => {
    const b = brief({}, "property_finder");
    expect(b.platform.hashtags).toBe(0);
    expect(b.platform.rules.join(" ")).toContain("phone numbers");
  });

  it("gives Instagram hashtags and a standalone hook", () => {
    const b = brief({}, "instagram");
    expect(b.platform.hashtags).toBeGreaterThan(0);
    expect(b.platform.sections[0]).toContain("Hook");
  });
});

describe("listingBriefToPrompt", () => {
  it("states the constraints before the creative task and repeats them at the end", () => {
    const p = listingBriefToPrompt(brief({ project: "Wadi Zaha" }));
    const constraintsAt = p.indexOf("Hard constraints");
    const outputAt = p.indexOf("## Output");
    expect(constraintsAt).toBeGreaterThan(-1);
    expect(constraintsAt).toBeLessThan(outputAt);
    expect(p).toContain("re-read the hard constraints");
  });

  it("carries every prohibition into the prompt text", () => {
    const b = brief({ project: "Wadi Zaha" });
    const p = listingBriefToPrompt(b);
    for (const m of b.mustNot) expect(p).toContain(m);
  });

  it("asks for both languages under separate headings when requested", () => {
    const b = buildListingBrief({
      unit: unit(),
      platform: "website",
      language: "both",
      catalogue: CATALOGUE,
    });
    const p = listingBriefToPrompt(b);
    expect(p).toContain("## English");
    expect(p).toContain("## العربية");
  });

  it("includes the agent's angle when one is given", () => {
    const b = buildListingBrief({
      unit: unit(),
      platform: "instagram",
      language: "en",
      catalogue: CATALOGUE,
      angle: "lead with the marina view",
    });
    expect(listingBriefToPrompt(b)).toContain("lead with the marina view");
  });

  it("ignores a blank angle", () => {
    const b = buildListingBrief({
      unit: unit(),
      platform: "instagram",
      language: "en",
      catalogue: CATALOGUE,
      angle: "   ",
    });
    expect(b.angle).toBeNull();
  });
});
