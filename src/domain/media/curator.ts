// Deterministic visual curator. Pure — ranks APPROVED-POOL candidates for a
// usage surface and reports quality warnings and a structured recommendation
// (the shape an optional LLM assistant would also return). It never invents
// associations, never overrides licensing (verifyUsage runs first at the
// call site), and marks anything unapproved as requiring approval.
import { assetQualityScore, textSafeSide } from "./selection";
import type { FocalPoint, MediaAsset } from "./types";

export interface CurationResult {
  assetId: string;
  /** 0–100 relative ranking score for the requested usage. */
  relevanceScore: number;
  recommendedUsage: "hero" | "card" | "thumbnail" | "unsuitable";
  recommendedFocalPoint: FocalPoint;
  textSafeArea: "left" | "right";
  qualityWarnings: string[];
  requiresApproval: boolean;
}

const HERO_MIN_WIDTH = 1600;
const CARD_MIN_WIDTH = 800;

/** Curate one asset: quality checks + usage recommendation. Deterministic. */
export function curateAsset(asset: MediaAsset): CurationResult {
  const warnings: string[] = [];
  const w = asset.widthPx ?? 0;
  const h = asset.heightPx ?? 0;

  if (w === 0 || h === 0) warnings.push("missing dimensions");
  if (w > 0 && w < CARD_MIN_WIDTH) warnings.push(`low resolution (${w}px wide)`);
  else if (w > 0 && w < HERO_MIN_WIDTH) warnings.push(`below hero resolution (${w}px < ${HERO_MIN_WIDTH}px)`);
  if (w > 0 && h > 0 && h > w) warnings.push("portrait orientation — poor banner fit");
  if (!asset.altText) warnings.push("missing alt text");
  if (!asset.classification) warnings.push("missing classification");
  if (!asset.blurDataUrl) warnings.push("missing blur placeholder");

  let recommendedUsage: CurationResult["recommendedUsage"];
  if (w >= HERO_MIN_WIDTH && h > 0 && w > h) recommendedUsage = "hero";
  else if (w >= CARD_MIN_WIDTH) recommendedUsage = "card";
  else if (w > 0) recommendedUsage = "thumbnail";
  else recommendedUsage = "unsuitable";

  // Normalize the tie-break score into 0–100 for reporting.
  const raw = assetQualityScore(asset);
  const relevanceScore = Math.max(0, Math.min(100, Math.round(50 + raw)));

  return {
    assetId: asset.id,
    relevanceScore,
    recommendedUsage,
    recommendedFocalPoint: asset.focal ?? { x: 0.5, y: 0.5 },
    textSafeArea: textSafeSide(asset),
    qualityWarnings: warnings,
    requiresApproval: asset.approvalStatus !== "approved",
  };
}

/** Rank a candidate pool best-first (score desc, id asc for determinism). */
export function rankCandidates(assets: MediaAsset[]): CurationResult[] {
  return assets
    .map(curateAsset)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.assetId.localeCompare(b.assetId));
}

/** Likely duplicates: same dimensions + same dominant color + same kind. */
export function findLikelyDuplicates(assets: MediaAsset[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const a of assets) {
    if (!a.widthPx || !a.heightPx || !a.dominantColor) continue;
    const key = `${a.widthPx}x${a.heightPx}:${a.dominantColor.toLowerCase()}:${a.kind ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), a.id]);
  }
  return [...groups.values()].filter((ids) => ids.length > 1).map((ids) => ids.sort());
}
