// Command Portal visual assembly: picks licensed imagery for editorial
// slides, news items, featured projects and the opportunity unit, signs all
// storage paths in ONE batch, and returns render-ready props. Everything
// degrades honestly — no database or no approved media simply means branded
// fallback art everywhere.
import {
  CLASSIFICATION_LABELS,
  HERO_CONTENT_LABELS,
  NON_PHOTO_CLASSIFICATIONS,
  type HeroContentType,
  type MediaAsset,
} from "@/domain/media/types";
import { focalToObjectPosition, selectHeroImage } from "@/domain/media/selection";
import type { HeroImage } from "../components/PortalHero";
import type {
  CardImage,
  FeaturedProjectCard,
  NewsCardItem,
  OpportunityCardData,
} from "../components/portal/PortalVisuals";
import {
  loadEditorialSlides,
  loadFeaturedProjects,
  loadHeroMediaPool,
  loadProjectNames,
  signStoragePaths,
  type HeroSlideRow,
} from "./heroMedia";
import { loadLiveOfferUnits } from "./warRoomUnits";
import type { NewsItem } from "./news";

export interface EditorialSlideView {
  row: HeroSlideRow;
  badge: string;
  image: HeroImage | null;
}

export interface PortalVisuals {
  editorial: EditorialSlideView[];
  /** Hero image (or null) per news item, index-aligned with the input. */
  newsImages: (HeroImage | null)[];
  newsCards: NewsCardItem[];
  featuredProjects: FeaturedProjectCard[];
  opportunity: OpportunityCardData | null;
}

function classificationChip(asset: MediaAsset): string | null {
  if (!asset.classification) return null;
  if (NON_PHOTO_CLASSIFICATIONS.has(asset.classification) || asset.classification === "stock") {
    return CLASSIFICATION_LABELS[asset.classification];
  }
  return null;
}

function toHeroImage(asset: MediaAsset, signed: Map<string, string>): HeroImage | null {
  const url = signed.get(asset.storagePath);
  if (!url) return null;
  return {
    url,
    alt: asset.altText ?? "",
    objectPosition: focalToObjectPosition(asset),
    objectPositionMobile: focalToObjectPosition(asset, true),
    blurDataUrl: asset.blurDataUrl,
    dominantColor: asset.dominantColor,
    attribution: asset.attribution,
    classificationLabel: classificationChip(asset),
  };
}

function toCardImage(asset: MediaAsset, signed: Map<string, string>): CardImage | null {
  const url = signed.get(asset.storagePath);
  if (!url) return null;
  return {
    url,
    alt: asset.altText ?? "",
    objectPosition: focalToObjectPosition(asset),
    blurDataUrl: asset.blurDataUrl,
    attribution: asset.attribution,
    classificationLabel: classificationChip(asset),
  };
}

/** Free text → related project name (for the news-card label). */
function relatedProject(
  text: string,
  projectNames: { id: string; name: string }[],
): { id: string; name: string } | null {
  const lower = text.toLowerCase();
  return (
    [...projectNames]
      .sort((a, b) => b.name.length - a.name.length)
      .find((p) => p.name.length >= 4 && lower.includes(p.name.toLowerCase())) ?? null
  );
}

export async function loadPortalVisuals(
  news: NewsItem[],
  viewerRole: "ADMIN" | "AGENT",
): Promise<PortalVisuals> {
  const [pool, editorialRows, projectNames, featured, units] = await Promise.all([
    loadHeroMediaPool(),
    loadEditorialSlides(viewerRole),
    loadProjectNames(),
    loadFeaturedProjects(3),
    loadLiveOfferUnits(),
  ]);
  const assets = pool ?? [];
  const names = projectNames ?? [];
  const nameToId = new Map(names.map((p) => [p.name, p.id]));

  // ---- Choose assets first, sign once ---------------------------------
  const chosen = new Map<string, MediaAsset>(); // key: purpose
  const byId = new Map(assets.map((a) => [a.id, a]));

  (editorialRows ?? []).forEach((row) => {
    if (row.fileId) {
      const a = byId.get(row.fileId);
      if (a) chosen.set(`ed:${row.id}`, a);
    }
  });
  news.forEach((n, i) => {
    const sel = selectHeroImage(assets, { text: n.title, projectNames: names });
    // Only exact-association matches for news — the general pool would attach
    // an unrelated image to a headline, which the fallback art avoids honestly.
    if (sel && sel.matchReason !== "general_approved") chosen.set(`news:${i}`, sel.asset);
  });
  (featured ?? []).forEach((p) => {
    const sel = selectHeroImage(assets, { projectId: p.projectId });
    if (sel && sel.matchReason === "exact_project") chosen.set(`proj:${p.projectId}`, sel.asset);
  });

  // Opportunity: best OMR/m² among live ITC availability (verified facts only).
  const itc = (units ?? []).filter(
    (u) => u.category === "ITC" && u.areaSqm > 0 && u.priceOmr > 0,
  );
  const bestUnit =
    itc.length > 0
      ? [...itc].sort(
          (a, b) => a.priceOmr / a.areaSqm - b.priceOmr / b.areaSqm || a.reference.localeCompare(b.reference),
        )[0]
      : null;
  if (bestUnit) {
    const projectId = nameToId.get(bestUnit.project);
    if (projectId) {
      const sel = selectHeroImage(assets, { projectId });
      if (sel && sel.matchReason === "exact_project") chosen.set("opportunity", sel.asset);
    }
  }

  const signed = await signStoragePaths([...chosen.values()].map((a) => a.storagePath));
  const img = (key: string): HeroImage | null => {
    const a = chosen.get(key);
    return a ? toHeroImage(a, signed) : null;
  };
  const card = (key: string): CardImage | null => {
    const a = chosen.get(key);
    return a ? toCardImage(a, signed) : null;
  };

  // ---- Build views ----------------------------------------------------
  const editorial: EditorialSlideView[] = (editorialRows ?? []).map((row) => ({
    row,
    badge:
      HERO_CONTENT_LABELS[row.contentType as HeroContentType] ?? HERO_CONTENT_LABELS.announcement,
    image: img(`ed:${row.id}`),
  }));

  const newsImages = news.map((_, i) => img(`news:${i}`));
  const newsCards: NewsCardItem[] = news.map((n, i) => ({
    title: n.title,
    link: n.link,
    source: n.source,
    publishedAt: n.publishedAt,
    image: card(`news:${i}`),
    relatedLabel: relatedProject(n.title, names)?.name ?? null,
  }));

  const featuredProjects: FeaturedProjectCard[] = (featured ?? []).map((p) => ({
    name: p.name,
    developer: p.developer,
    categoryLabel: p.category,
    openToAll: p.category === "ITC",
    availableUnits: p.availableUnits,
    startingPriceOmr: p.startingPriceOmr,
    unitTypes: p.unitTypes,
    image: card(`proj:${p.projectId}`),
  }));

  const opportunity: OpportunityCardData | null = bestUnit
    ? {
        reference: bestUnit.reference,
        project: bestUnit.project,
        developer: bestUnit.developer,
        unitType: bestUnit.unitType,
        areaSqm: bestUnit.areaSqm,
        priceOmr: bestUnit.priceOmr,
        pricePerSqmOmr: bestUnit.priceOmr / bestUnit.areaSqm,
        openToAll: bestUnit.ownershipEligibility === "all_nationalities",
        image: card("opportunity"),
      }
    : null;

  return { editorial, newsImages, newsCards, featuredProjects, opportunity };
}
