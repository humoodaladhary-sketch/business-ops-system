import { describe, it, expect } from "vitest";
import { verifyUsage, usableOn } from "./rights";
import {
  assetQualityScore,
  focalToObjectPosition,
  selectHeroImage,
  textSafeSide,
} from "./selection";
import { isSlideActive, orderSlides, MAX_HERO_SLIDES, type ScheduledSlide } from "./heroSchedule";
import { curateAsset, findLikelyDuplicates, rankCandidates } from "./curator";
import { sanitizeFileName, validateAltText, validateUpload } from "./upload";
import type { MediaAsset } from "./types";

/** Fully-approved hero-ready photo; override per test. */
const asset = (over: Partial<MediaAsset>): MediaAsset => ({
  id: "m1",
  storagePath: "media/a.jpg",
  kind: "inventory",
  projectId: null,
  unitId: null,
  sourceType: "alwalaa_owned",
  sourceUrl: null,
  ownerName: "Alwalaa Real Estate",
  licenseType: "owned",
  licenseAllowsHero: true,
  licenseAllowsReports: true,
  attribution: null,
  classification: "photo",
  approvalStatus: "approved",
  altText: "Waterfront apartments at dusk",
  focal: { x: 0.5, y: 0.5 },
  focalMobile: null,
  widthPx: 2400,
  heightPx: 1350,
  blurDataUrl: "data:image/jpeg;base64,xxx",
  dominantColor: "#20242a",
  locationLabel: "Muscat",
  lastVerifiedAt: "2026-08-01",
  ...over,
});

// ---------------------------------------------------------------------------
// Rights
// ---------------------------------------------------------------------------

describe("verifyUsage", () => {
  it("allows an approved, licensed, classified asset on the hero", () => {
    const r = verifyUsage(asset({}), "hero");
    expect(r.allowed).toBe(true);
    expect(r.reasons).toEqual([]);
    expect(r.requiresRenderingLabel).toBe(false);
  });

  it("blocks unapproved, unlicensed and unclassified assets", () => {
    expect(verifyUsage(asset({ approvalStatus: "pending" }), "hero").allowed).toBe(false);
    expect(verifyUsage(asset({ approvalStatus: "rejected" }), "hero").allowed).toBe(false);
    expect(verifyUsage(asset({ licenseType: "unknown" }), "hero").allowed).toBe(false);
    expect(verifyUsage(asset({ licenseType: null }), "hero").allowed).toBe(false);
    expect(verifyUsage(asset({ classification: null }), "hero").allowed).toBe(false);
  });

  it("report distribution needs the report license flag specifically", () => {
    const heroOnly = asset({ licenseAllowsReports: false });
    expect(verifyUsage(heroOnly, "hero").allowed).toBe(true);
    const rep = verifyUsage(heroOnly, "report");
    expect(rep.allowed).toBe(false);
    expect(rep.reasons[0]).toContain("report");
  });

  it("renderings carry a mandatory labeling flag (never shown as reality)", () => {
    const r = verifyUsage(asset({ classification: "developer_render" }), "hero");
    expect(r.allowed).toBe(true);
    expect(r.requiresRenderingLabel).toBe(true);
  });

  it("surfaces required attribution", () => {
    const r = verifyUsage(asset({ attribution: "© Al Mouj Muscat" }), "card");
    expect(r.requiredAttribution).toBe("© Al Mouj Muscat");
  });

  it("usableOn filters a mixed pool", () => {
    const pool = [asset({ id: "ok" }), asset({ id: "bad", approvalStatus: "pending" })];
    expect(usableOn(pool, "hero").map((a) => a.id)).toEqual(["ok"]);
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe("selectHeroImage", () => {
  const pool = [
    asset({ id: "unit-img", unitId: "u1", projectId: "p1", locationLabel: null }),
    asset({ id: "proj-img", projectId: "p1", locationLabel: null }),
    asset({ id: "mouj-img", projectId: "p2", locationLabel: null }),
    asset({ id: "muscat-img", locationLabel: "Muscat skyline" }),
    asset({ id: "general-img", kind: "hero_general", locationLabel: null }),
  ];
  const projectNames = [
    { id: "p2", name: "Al Mouj" },
    { id: "p1", name: "Muscat Bay" },
  ];

  it("prefers the exact unit image, then the exact project image", () => {
    expect(selectHeroImage(pool, { unitId: "u1", projectId: "p1" })?.asset.id).toBe("unit-img");
    expect(selectHeroImage(pool, { projectId: "p1" })?.asset.id).toBe("proj-img");
  });

  it("matches a project named in free text (news headline)", () => {
    const r = selectHeroImage(pool, {
      text: "Al Mouj attracts RO 880 million in FDI",
      projectNames,
    });
    expect(r?.asset.id).toBe("mouj-img");
    expect(r?.matchReason).toBe("text_matched_project");
  });

  it("falls back to location, then explicit general hero media", () => {
    expect(selectHeroImage(pool, { locationLabel: "muscat" })?.asset.id).toBe("muscat-img");
    expect(selectHeroImage(pool, {})?.asset.id).toBe("general-img");
    expect(selectHeroImage(pool, {})?.matchReason).toBe("general_approved");
  });

  it("returns null rather than attaching an unrelated image", () => {
    const noGeneral = pool.filter((a) => a.kind !== "hero_general");
    // Unrelated story, no matching project/location → branded fallback (null)
    expect(selectHeroImage(noGeneral, { text: "Oman GDP grows", projectNames })).toBeNull();
  });

  it("never selects unusable assets even on exact association", () => {
    const blocked = [asset({ id: "u", unitId: "u1", approvalStatus: "pending" })];
    expect(selectHeroImage(blocked, { unitId: "u1" })).toBeNull();
  });

  it("prefers photos and higher resolution inside a tier", () => {
    const p = [
      asset({ id: "small", projectId: "p9", widthPx: 900, heightPx: 600 }),
      asset({ id: "big", projectId: "p9", widthPx: 2400, heightPx: 1350 }),
      asset({ id: "render", projectId: "p9", classification: "developer_render" }),
    ];
    expect(selectHeroImage(p, { projectId: "p9" })?.asset.id).toBe("big");
    expect(assetQualityScore(p[1])).toBeGreaterThan(assetQualityScore(p[2]));
  });
});

describe("focal point helpers", () => {
  it("maps the focal point to CSS object-position (clamped)", () => {
    expect(focalToObjectPosition(asset({ focal: { x: 0.68, y: 0.44 } }))).toBe("68% 44%");
    expect(focalToObjectPosition(asset({ focal: { x: 1.7, y: -0.2 } }))).toBe("100% 0%");
    expect(focalToObjectPosition(asset({ focal: null }))).toBe("50% 50%");
  });

  it("uses the mobile focal point only when asked and set", () => {
    const a = asset({ focal: { x: 0.2, y: 0.5 }, focalMobile: { x: 0.8, y: 0.3 } });
    expect(focalToObjectPosition(a)).toBe("20% 50%");
    expect(focalToObjectPosition(a, true)).toBe("80% 30%");
    expect(focalToObjectPosition(asset({ focal: { x: 0.2, y: 0.5 } }), true)).toBe("20% 50%");
  });

  it("derives the text-safe side from the subject position", () => {
    expect(textSafeSide(asset({ focal: { x: 0.7, y: 0.5 } }))).toBe("left");
    expect(textSafeSide(asset({ focal: { x: 0.2, y: 0.5 } }))).toBe("right");
    expect(textSafeSide(asset({ focal: null }))).toBe("left");
  });
});

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

describe("hero scheduling", () => {
  const NOW = new Date("2026-08-02T12:00:00Z");
  const slide = (over: Partial<ScheduledSlide>): ScheduledSlide => ({
    id: "s1",
    status: "published",
    startsAt: null,
    endsAt: null,
    pinned: false,
    priority: 100,
    audience: "all",
    createdAt: "2026-08-01T00:00:00Z",
    ...over,
  });

  it("only published slides inside their window are active", () => {
    expect(isSlideActive(slide({}), NOW, "ADMIN")).toBe(true);
    expect(isSlideActive(slide({ status: "draft" }), NOW, "ADMIN")).toBe(false);
    expect(isSlideActive(slide({ startsAt: "2026-08-03T00:00:00Z" }), NOW, "ADMIN")).toBe(false);
    expect(isSlideActive(slide({ endsAt: "2026-08-01T00:00:00Z" }), NOW, "ADMIN")).toBe(false);
    expect(isSlideActive(slide({ endsAt: "2026-08-10T00:00:00Z" }), NOW, "ADMIN")).toBe(true);
  });

  it("audience scoping filters by viewer role", () => {
    expect(isSlideActive(slide({ audience: "admin" }), NOW, "AGENT")).toBe(false);
    expect(isSlideActive(slide({ audience: "admin" }), NOW, "ADMIN")).toBe(true);
    expect(isSlideActive(slide({ audience: "agents" }), NOW, "ADMIN")).toBe(false);
  });

  it("orders pinned → priority → newest and caps the carousel", () => {
    const slides = [
      slide({ id: "old-low", priority: 50, createdAt: "2026-07-01T00:00:00Z" }),
      slide({ id: "pinned", pinned: true, priority: 999 }),
      slide({ id: "new-low", priority: 50, createdAt: "2026-08-01T00:00:00Z" }),
      slide({ id: "high", priority: 10 }),
    ];
    expect(orderSlides(slides, NOW, "ADMIN").map((s) => s.id)).toEqual([
      "pinned",
      "high",
      "new-low",
      "old-low",
    ]);
    const many = Array.from({ length: 10 }, (_, i) => slide({ id: `s${i}` }));
    expect(orderSlides(many, NOW, "ADMIN")).toHaveLength(MAX_HERO_SLIDES);
  });
});

// ---------------------------------------------------------------------------
// Curator
// ---------------------------------------------------------------------------

describe("curator", () => {
  it("recommends hero for large landscape photos and flags gaps", () => {
    const r = curateAsset(asset({}));
    expect(r.recommendedUsage).toBe("hero");
    expect(r.qualityWarnings).toEqual([]);
    expect(r.requiresApproval).toBe(false);
    expect(r.recommendedFocalPoint).toEqual({ x: 0.5, y: 0.5 });
  });

  it("downgrades small and portrait imagery with explicit warnings", () => {
    const small = curateAsset(asset({ widthPx: 600, heightPx: 400, blurDataUrl: null }));
    expect(small.recommendedUsage).toBe("thumbnail");
    expect(small.qualityWarnings.join(" ")).toContain("low resolution");
    const portrait = curateAsset(asset({ widthPx: 1600, heightPx: 2400 }));
    expect(portrait.qualityWarnings.join(" ")).toContain("portrait");
  });

  it("marks unapproved assets and ranks a pool deterministically", () => {
    const pool = [
      asset({ id: "b", widthPx: 1200, heightPx: 800 }),
      asset({ id: "a", widthPx: 2400, heightPx: 1350 }),
      asset({ id: "c", approvalStatus: "pending" }),
    ];
    const ranked = rankCandidates(pool);
    expect(ranked[0].assetId).toBe("a");
    expect(ranked.find((r) => r.assetId === "c")?.requiresApproval).toBe(true);
  });

  it("groups likely duplicates by dimensions + dominant color", () => {
    const dupes = findLikelyDuplicates([
      asset({ id: "x1" }),
      asset({ id: "x2" }),
      asset({ id: "y", dominantColor: "#ffffff" }),
    ]);
    expect(dupes).toEqual([["x1", "x2"]]);
  });
});

// ---------------------------------------------------------------------------
// Upload validation
// ---------------------------------------------------------------------------

describe("upload validation", () => {
  it("accepts a normal JPG and sanitizes the name", () => {
    const v = validateUpload({
      fileName: "Al Mouj — Marina VIEW (final) v2.JPG",
      mimeType: "image/jpeg",
      sizeBytes: 2_000_000,
      widthPx: 2400,
      heightPx: 1600,
    });
    expect(v.ok).toBe(true);
    expect(v.safeName).toBe("al-mouj-marina-view-final-v2.jpg");
  });

  it("rejects SVG, oversize files and tiny dimensions", () => {
    expect(validateUpload({ fileName: "a.svg", mimeType: "image/svg+xml", sizeBytes: 100 }).ok).toBe(false);
    expect(
      validateUpload({ fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 99_000_000 }).ok,
    ).toBe(false);
    const tiny = validateUpload({
      fileName: "a.png",
      mimeType: "image/png",
      sizeBytes: 1000,
      widthPx: 100,
      heightPx: 100,
    });
    expect(tiny.ok).toBe(false);
    expect(tiny.errors.join(" ")).toContain("too small");
  });

  it("sanitizeFileName never returns an empty base", () => {
    expect(sanitizeFileName("____.png")).toBe("image.png");
  });

  it("validates alt text (present, descriptive, not a filename)", () => {
    expect(validateAltText("Waterfront residences at Al Mouj marina").ok).toBe(true);
    expect(validateAltText("").ok).toBe(false);
    expect(validateAltText("img_1.jpg").ok).toBe(false);
    expect(validateAltText("photo").ok).toBe(false);
  });
});
