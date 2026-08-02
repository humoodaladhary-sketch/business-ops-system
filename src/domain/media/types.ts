// Visual-media domain types. Pure — no I/O, no framework imports.
//
// The rule that governs everything here: an image is only publishable when
// its rights are KNOWN and its nature is HONESTLY classified. A developer
// rendering is never presented as a completed property; an image without a
// license never reaches the hero; missing imagery gets branded fallback art,
// never a random photo.

/** Where an asset came from — mirrors files.source_type. */
export type MediaSourceType =
  | "alwalaa_owned"
  | "inventory"
  | "upload"
  | "developer"
  | "news_source"
  | "licensed_stock"
  | "branded";

/** What an image actually IS — mirrors files.classification. */
export type MediaClassification =
  | "photo"
  | "developer_render"
  | "arch_visualization"
  | "concept"
  | "stock"
  | "branded_graphic";

export type MediaLicenseType =
  | "owned"
  | "developer_approved"
  | "editorial"
  | "royalty_free"
  | "rights_managed"
  | "unknown";

export type MediaApprovalStatus = "pending" | "approved" | "rejected";

export interface FocalPoint {
  /** 0..1 from the left edge. */
  x: number;
  /** 0..1 from the top edge. */
  y: number;
}

/** A media asset with its governance metadata (a `files` row, domain-shaped). */
export interface MediaAsset {
  id: string;
  storagePath: string;
  kind: string | null;
  projectId: string | null;
  unitId: string | null;
  sourceType: MediaSourceType | null;
  sourceUrl: string | null;
  ownerName: string | null;
  licenseType: MediaLicenseType | null;
  licenseAllowsHero: boolean;
  licenseAllowsReports: boolean;
  attribution: string | null;
  classification: MediaClassification | null;
  approvalStatus: MediaApprovalStatus;
  altText: string | null;
  focal: FocalPoint | null;
  focalMobile: FocalPoint | null;
  widthPx: number | null;
  heightPx: number | null;
  blurDataUrl: string | null;
  dominantColor: string | null;
  locationLabel: string | null;
  lastVerifiedAt: string | null;
}

/** Hero slide content types — mirrors hero_slides.content_type. */
export type HeroContentType =
  | "market_news"
  | "featured_property"
  | "featured_project"
  | "investment_opportunity"
  | "new_inventory"
  | "oman_update"
  | "announcement"
  | "collection_priority"
  | "campaign";

export const HERO_CONTENT_LABELS: Record<HeroContentType, string> = {
  market_news: "Market update",
  featured_property: "Featured property",
  featured_project: "Featured project",
  investment_opportunity: "Investment opportunity",
  new_inventory: "New inventory",
  oman_update: "Oman development",
  announcement: "Announcement",
  collection_priority: "Collections priority",
  campaign: "Campaign",
};

/** Human labels for classifications shown next to imagery (honesty rule). */
export const CLASSIFICATION_LABELS: Record<MediaClassification, string> = {
  photo: "Photograph",
  developer_render: "Developer rendering",
  arch_visualization: "Architectural visualization",
  concept: "Concept image",
  stock: "Stock image",
  branded_graphic: "Branded graphic",
};

/** Classifications that must NEVER be captioned as completed reality. */
export const NON_PHOTO_CLASSIFICATIONS: ReadonlySet<MediaClassification> = new Set([
  "developer_render",
  "arch_visualization",
  "concept",
]);
