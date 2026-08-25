// Media-rights validation. Pure and deterministic — the single gate every
// image passes before it is shown anywhere. "When in doubt, keep it out":
// unknown license, missing approval or missing classification all block
// publication; the UI then falls back to branded artwork instead.
import {
  NON_PHOTO_CLASSIFICATIONS,
  type MediaAsset,
} from "./types";

export type MediaSurface = "hero" | "card" | "report";

export interface MediaRightsResult {
  allowed: boolean;
  /** Every reason the asset is blocked (empty when allowed). */
  reasons: string[];
  /** Credit line that MUST be displayed when the asset is used. */
  requiredAttribution: string | null;
  /** True when the surface must label the image as a rendering/visualization. */
  requiresRenderingLabel: boolean;
}

/**
 * Validates whether an asset may be used on a surface.
 *
 * Blocks when: not approved · classification missing · license unknown/missing
 * · license does not extend to the surface (hero flag for hero AND card
 * surfaces, reports flag for report distribution).
 */
export function verifyUsage(asset: MediaAsset, surface: MediaSurface): MediaRightsResult {
  const reasons: string[] = [];

  if (asset.approvalStatus !== "approved") {
    reasons.push(`not approved (status: ${asset.approvalStatus})`);
  }
  if (!asset.classification) {
    reasons.push("missing classification — photo vs rendering must be stated");
  }
  if (!asset.licenseType || asset.licenseType === "unknown") {
    reasons.push("license unknown — cannot publish");
  } else if (surface === "report") {
    if (!asset.licenseAllowsReports) {
      reasons.push("license does not permit report distribution");
    }
  } else if (!asset.licenseAllowsHero) {
    reasons.push("license does not permit dashboard display");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    requiredAttribution: asset.attribution?.trim() ? asset.attribution.trim() : null,
    requiresRenderingLabel:
      asset.classification != null && NON_PHOTO_CLASSIFICATIONS.has(asset.classification),
  };
}

/** Convenience: filter a pool down to what a surface may legally show. */
export function usableOn(assets: MediaAsset[], surface: MediaSurface): MediaAsset[] {
  return assets.filter((a) => verifyUsage(a, surface).allowed);
}
