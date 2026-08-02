// Deterministic hero/news image selection. Pure.
//
// Source-priority ladder (task §3/§16): exact association beats category
// match beats fallback; owned media beats external. When nothing usable
// matches, the answer is `null` — the UI renders branded fallback art. An
// unrelated photo is never attached to a story: relevance here means an
// EXPLICIT association (project/unit id or a matched project name in the
// text), not visual similarity.
import { usableOn } from "./rights";
import type { MediaAsset, MediaSourceType } from "./types";

/** Lower = preferred. Mirrors the licensed-source preference order. */
const SOURCE_RANK: Record<MediaSourceType, number> = {
  alwalaa_owned: 0,
  inventory: 1,
  upload: 2,
  developer: 3,
  news_source: 4,
  licensed_stock: 5,
  branded: 6,
};

/** Deterministic quality score used only to break ties inside a priority tier. */
export function assetQualityScore(a: MediaAsset): number {
  let score = 0;
  // Real photography beats renders for hero storytelling; branded graphics last.
  if (a.classification === "photo") score += 30;
  else if (a.classification === "developer_render" || a.classification === "arch_visualization") score += 18;
  else if (a.classification === "stock") score += 10;
  // Resolution: hero-worthy at ≥1600px wide, penalize small files hard.
  const w = a.widthPx ?? 0;
  if (w >= 2400) score += 25;
  else if (w >= 1600) score += 20;
  else if (w >= 1200) score += 10;
  else if (w > 0 && w < 800) score -= 30;
  // Landscape orientation suits the banner.
  if (a.widthPx && a.heightPx && a.widthPx > a.heightPx) score += 10;
  // Metadata completeness = editorial readiness.
  if (a.altText) score += 5;
  if (a.focal) score += 5;
  if (a.blurDataUrl) score += 3;
  // Preferred sources win ties.
  score -= (a.sourceType ? SOURCE_RANK[a.sourceType] : 6) * 2;
  return score;
}

/** Sort helper: best-first inside a tier, id as the final deterministic tiebreak. */
function best(assets: MediaAsset[]): MediaAsset | null {
  if (assets.length === 0) return null;
  return [...assets].sort(
    (a, b) => assetQualityScore(b) - assetQualityScore(a) || a.id.localeCompare(b.id),
  )[0];
}

export interface SelectionContext {
  /** Explicit associations, when the content carries them. */
  projectId?: string | null;
  unitId?: string | null;
  /** Free text (news headline etc.) matched against known project names. */
  text?: string | null;
  /** Known project names → ids, for text matching. */
  projectNames?: { id: string; name: string }[];
  /** Location label ("Muscat", "Al Mouj") matched against asset locationLabel. */
  locationLabel?: string | null;
}

export interface HeroImageSelection {
  asset: MediaAsset;
  /** Why this asset was chosen — shown in internal metadata, never invented. */
  matchReason:
    | "exact_unit"
    | "exact_project"
    | "text_matched_project"
    | "location"
    | "general_approved";
}

/**
 * Picks the best usable image for a piece of hero/news content, or null when
 * nothing legitimately matches (callers then use branded fallback art).
 *
 * Priority: exact unit image → exact project image → project matched from the
 * text → location image → general approved Alwalaa/branded media explicitly
 * marked kind='hero_general'. A random approved photo of some OTHER project
 * is never used for unrelated content.
 */
export function selectHeroImage(
  pool: MediaAsset[],
  ctx: SelectionContext,
): HeroImageSelection | null {
  const usable = usableOn(pool, "hero");
  if (usable.length === 0) return null;

  if (ctx.unitId) {
    const hit = best(usable.filter((a) => a.unitId === ctx.unitId));
    if (hit) return { asset: hit, matchReason: "exact_unit" };
  }
  if (ctx.projectId) {
    const hit = best(usable.filter((a) => a.projectId === ctx.projectId));
    if (hit) return { asset: hit, matchReason: "exact_project" };
  }
  if (ctx.text && ctx.projectNames && ctx.projectNames.length > 0) {
    const lower = ctx.text.toLowerCase();
    // Longest project name first so "Al Mouj Marina" beats "Al Mouj".
    const matched = [...ctx.projectNames]
      .sort((a, b) => b.name.length - a.name.length)
      .find((p) => p.name.length >= 4 && lower.includes(p.name.toLowerCase()));
    if (matched) {
      const hit = best(usable.filter((a) => a.projectId === matched.id));
      if (hit) return { asset: hit, matchReason: "text_matched_project" };
    }
  }
  if (ctx.locationLabel) {
    const loc = ctx.locationLabel.toLowerCase();
    const hit = best(
      usable.filter((a) => a.locationLabel != null && a.locationLabel.toLowerCase().includes(loc)),
    );
    if (hit) return { asset: hit, matchReason: "location" };
  }
  // General pool: only assets explicitly published for generic hero use.
  const general = best(usable.filter((a) => a.kind === "hero_general"));
  if (general) return { asset: general, matchReason: "general_approved" };

  return null;
}

// ---------------------------------------------------------------------------
// Focal point → CSS
// ---------------------------------------------------------------------------

/** Clamp a focal coordinate into 0..1. */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * CSS object-position for an asset (e.g. "68% 44%"). Defaults to center.
 * `mobile` prefers the mobile focal point when set.
 */
export function focalToObjectPosition(asset: MediaAsset, mobile = false): string {
  const f = (mobile ? asset.focalMobile : null) ?? asset.focal;
  if (!f) return "50% 50%";
  return `${Math.round(clamp01(f.x) * 100)}% ${Math.round(clamp01(f.y) * 100)}%`;
}

/**
 * Which side of the banner is text-safe, from the focal point: subject on the
 * right → text goes left, and vice versa. Center focal defaults to left text
 * (the banner's natural reading side).
 */
export function textSafeSide(asset: MediaAsset): "left" | "right" {
  const x = asset.focal?.x ?? 0.5;
  return x >= 0.5 ? "left" : "right";
}
