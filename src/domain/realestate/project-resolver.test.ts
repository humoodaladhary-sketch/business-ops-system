import { describe, expect, it } from "vitest";
import { ITC_PROJECTS } from "@/app/_data/itc-zones";
import { DEFAULT_UNITS } from "@/app/_data/runtimeConfig";
import {
  boundedEditDistance,
  eligibilityOf,
  foreignOwnershipAllowed,
  normalizeProjectName,
  resolveProject,
  type ProjectRef,
} from "./project-resolver";

const CATALOGUE: readonly ProjectRef[] = ITC_PROJECTS;

describe("normalizeProjectName", () => {
  it("lowercases, strips punctuation and drops noise words", () => {
    expect(normalizeProjectName("The Sustainable City — Yiti")).toBe("sustainable city yiti");
    expect(normalizeProjectName("Yenaier Residences")).toBe("yenaier");
    expect(normalizeProjectName("Al Mouj Muscat")).toBe("al mouj");
  });

  it("folds apostrophes into the word rather than splitting on them", () => {
    expect(normalizeProjectName("Hay Al We'am")).toBe("hay al weam");
    expect(normalizeProjectName("Hay Al We’am")).toBe("hay al weam");
  });

  it("keeps a name made entirely of noise words instead of returning an empty key", () => {
    expect(normalizeProjectName("The Project")).toBe("the project");
  });

  it("returns an empty key for empty input", () => {
    expect(normalizeProjectName("   ")).toBe("");
  });
});

describe("boundedEditDistance", () => {
  it("measures small edits", () => {
    expect(boundedEditDistance("vistal", "vistol", 2)).toBe(1);
    expect(boundedEditDistance("hayalwafaa", "hayalwafa", 2)).toBe(1);
    expect(boundedEditDistance("same", "same", 2)).toBe(0);
  });

  it("abandons once the distance provably exceeds the bound", () => {
    expect(boundedEditDistance("aida", "mandarinoriental", 2)).toBeGreaterThan(2);
    expect(boundedEditDistance("abcdefgh", "zzzzzzzz", 3)).toBe(4);
  });

  it("handles empty strings", () => {
    expect(boundedEditDistance("", "abc", 5)).toBe(3);
    expect(boundedEditDistance("abc", "", 5)).toBe(3);
  });
});

describe("resolveProject — exact and paired names", () => {
  it("matches an ITC project exactly", () => {
    const r = resolveProject("Al Mouj Muscat", CATALOGUE);
    expect(r.confidence).toBe("exact");
    expect(r.trusted).toBe(true);
    expect(r.project?.category).toBe("ITC");
    expect(foreignOwnershipAllowed(r)).toBe(true);
  });

  it("matches either half of a paired catalogue name", () => {
    for (const half of ["Jebel Sifah", "Hawana Salalah"]) {
      const r = resolveProject(half, CATALOGUE);
      expect(r.project?.name).toBe("Jebel Sifah / Hawana Salalah");
      expect(r.trusted).toBe(true);
    }
  });

  it("is insensitive to case and punctuation", () => {
    const r = resolveProject("  al   mouj,  MUSCAT ", CATALOGUE);
    expect(r.project?.name).toBe("Al Mouj Muscat");
    expect(r.confidence).toBe("exact");
  });
});

describe("resolveProject — curated aliases are trusted", () => {
  it("resolves the inventory spelling 'Hay Al Wafaa' onto 'Hay Al Wafa'", () => {
    const r = resolveProject("Hay Al Wafaa", CATALOGUE);
    expect(r.project?.name).toBe("Hay Al Wafa");
    expect(r.trusted).toBe(true);
    expect(eligibilityOf(r)).toBe("gcc_omani_only");
  });

  it("resolves the shortened 'Yenaire' onto the full catalogue name", () => {
    const r = resolveProject("Yenaire", CATALOGUE);
    expect(r.project?.name).toBe("Yenaier Residences / Hay Al We'am");
    expect(r.trusted).toBe(true);
    expect(eligibilityOf(r)).toBe("gcc_omani_only");
  });
});

describe("resolveProject — fail-safe direction", () => {
  // The whole point of the resolver: a near-miss must never be the basis for
  // telling a foreign investor they can take freehold title.
  it("reports a fuzzy match but refuses to derive foreign eligibility from it", () => {
    const r = resolveProject("Vistol", CATALOGUE);
    expect(r.confidence).toBe("fuzzy");
    expect(r.project?.name).toBe("Vistal");
    // Vistal really is ITC / all nationalities...
    expect(r.project?.ownershipEligibility).toBe("all_nationalities");
    // ...but the match is not trusted, so the listing layer gets "unknown".
    expect(r.trusted).toBe(false);
    expect(eligibilityOf(r)).toBe("unknown");
    expect(foreignOwnershipAllowed(r)).toBe(false);
  });

  it("returns 'unknown' for a project that is not in the catalogue at all", () => {
    const r = resolveProject("Some Tower That Does Not Exist", CATALOGUE);
    expect(r.confidence).toBe("none");
    expect(r.project).toBeNull();
    expect(eligibilityOf(r)).toBe("unknown");
    expect(foreignOwnershipAllowed(r)).toBe(false);
  });

  it("returns 'unknown' for empty input rather than matching everything", () => {
    const r = resolveProject("", CATALOGUE);
    expect(r.confidence).toBe("none");
    expect(foreignOwnershipAllowed(r)).toBe(false);
  });
});

describe("seeded inventory resolves against the signed catalogue", () => {
  // A regression guard on real data. Every unit currently in inventory sits in
  // a Future Cities master plan — Omani and GCC buyers only. If any of these
  // silently stopped resolving, the listing generator would fall back to
  // "unknown" and quietly lose the ability to describe the stock correctly.
  it.each(DEFAULT_UNITS.map((u) => u.project))("resolves %s to a trusted match", (project) => {
    const r = resolveProject(project, CATALOGUE);
    expect(r.trusted).toBe(true);
    expect(r.project).not.toBeNull();
  });

  it("finds no foreign-eligible stock in the current inventory", () => {
    const foreignEligible = DEFAULT_UNITS.filter((u) =>
      foreignOwnershipAllowed(resolveProject(u.project, CATALOGUE)),
    );
    expect(foreignEligible).toEqual([]);
  });
});
