// Server-side loaders for the Command Portal's visual media: the approved
// media pool (files + governance columns from 0011), published hero slides,
// and short-lived signed URLs from the PRIVATE media bucket (see
// MEDIA_BUCKET — Supabase bucket ids are case-sensitive). Everything
// is null-safe: no database → no imagery → branded fallback art. No public
// buckets, no hotlinking, no unlicensed pixels.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/storage";
import { ORG_ID } from "../_departments/config";
import type { MediaAsset } from "@/domain/media/types";
import { orderSlides, type ScheduledSlide } from "@/domain/media/heroSchedule";
import { usableOn } from "@/domain/media/rights";

const SIGNED_URL_TTL_SECONDS = 3600; // per-request render; links outlive the page comfortably

interface FileRow {
  id: string;
  storage_path: string;
  kind: string | null;
  project_id: string | null;
  unit_id: string | null;
  source_type: string | null;
  source_url: string | null;
  owner_name: string | null;
  license_type: string | null;
  license_allows_hero: boolean | null;
  license_allows_reports: boolean | null;
  attribution: string | null;
  classification: string | null;
  approval_status: string | null;
  alt_text: string | null;
  focal_x: number | string | null;
  focal_y: number | string | null;
  focal_x_mobile: number | string | null;
  focal_y_mobile: number | string | null;
  width_px: number | null;
  height_px: number | null;
  blur_data_url: string | null;
  dominant_color: string | null;
  location_label: string | null;
  last_verified_at: string | null;
}

const num = (v: number | string | null): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;

function mapAsset(r: FileRow): MediaAsset {
  const fx = num(r.focal_x);
  const fy = num(r.focal_y);
  const fxm = num(r.focal_x_mobile);
  const fym = num(r.focal_y_mobile);
  return {
    id: r.id,
    storagePath: r.storage_path,
    kind: r.kind,
    projectId: r.project_id,
    unitId: r.unit_id,
    sourceType: (r.source_type as MediaAsset["sourceType"]) ?? null,
    sourceUrl: r.source_url,
    ownerName: r.owner_name,
    licenseType: (r.license_type as MediaAsset["licenseType"]) ?? null,
    licenseAllowsHero: Boolean(r.license_allows_hero),
    licenseAllowsReports: Boolean(r.license_allows_reports),
    attribution: r.attribution,
    classification: (r.classification as MediaAsset["classification"]) ?? null,
    approvalStatus: (r.approval_status as MediaAsset["approvalStatus"]) ?? "pending",
    altText: r.alt_text,
    focal: fx != null && fy != null ? { x: fx, y: fy } : null,
    focalMobile: fxm != null && fym != null ? { x: fxm, y: fym } : null,
    widthPx: r.width_px,
    heightPx: r.height_px,
    blurDataUrl: r.blur_data_url,
    dominantColor: r.dominant_color,
    locationLabel: r.location_label,
    lastVerifiedAt: r.last_verified_at,
  };
}

/** Approved, hero-usable media pool (bounded). Null when no database. */
export async function loadHeroMediaPool(): Promise<MediaAsset[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("files")
    .select(
      "id,storage_path,kind,project_id,unit_id,source_type,source_url,owner_name,license_type,license_allows_hero,license_allows_reports,attribution,classification,approval_status,alt_text,focal_x,focal_y,focal_x_mobile,focal_y_mobile,width_px,height_px,blur_data_url,dominant_color,location_label,last_verified_at",
    )
    .eq("organization_id", ORG_ID)
    .eq("approval_status", "approved")
    .eq("license_allows_hero", true)
    .limit(200);
  if (error || !data) return null;
  // verifyUsage is still the authority — the query is only a prefilter.
  return usableOn((data as unknown as FileRow[]).map(mapAsset), "hero");
}

export interface HeroSlideRow extends ScheduledSlide {
  contentType: string;
  eyebrow: string | null;
  title: string;
  description: string | null;
  fileId: string | null;
  primaryLabel: string | null;
  primaryHref: string | null;
  secondaryLabel: string | null;
  secondaryHref: string | null;
  sourceLabel: string | null;
}

/** Published editorial hero slides, scheduled and ordered. Null when no DB. */
export async function loadEditorialSlides(
  viewerRole: "ADMIN" | "AGENT",
  now = new Date(),
): Promise<HeroSlideRow[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("hero_slides")
    .select(
      "id,content_type,eyebrow,title,description,file_id,primary_label,primary_href,secondary_label,secondary_href,source_label,starts_at,ends_at,priority,pinned,audience,status,created_at",
    )
    .eq("organization_id", ORG_ID)
    .eq("status", "published")
    .limit(50);
  if (error || !data) return null;

  const rows: HeroSlideRow[] = (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    status: r.status as ScheduledSlide["status"],
    startsAt: (r.starts_at as string) ?? null,
    endsAt: (r.ends_at as string) ?? null,
    pinned: Boolean(r.pinned),
    priority: (r.priority as number) ?? 100,
    audience: (r.audience as ScheduledSlide["audience"]) ?? "all",
    createdAt: (r.created_at as string) ?? "",
    contentType: (r.content_type as string) ?? "announcement",
    eyebrow: (r.eyebrow as string) ?? null,
    title: (r.title as string) ?? "",
    description: (r.description as string) ?? null,
    fileId: (r.file_id as string) ?? null,
    primaryLabel: (r.primary_label as string) ?? null,
    primaryHref: (r.primary_href as string) ?? null,
    secondaryLabel: (r.secondary_label as string) ?? null,
    secondaryHref: (r.secondary_href as string) ?? null,
    sourceLabel: (r.source_label as string) ?? null,
  }));
  return orderSlides(rows, now, viewerRole, 4); // editorial takes ≤4 of the 6 slots
}

/** Signed URLs for a set of storage paths (private bucket). Empty map on failure. */
export async function signStoragePaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const db = supabaseAdmin();
  if (!db || paths.length === 0) return map;
  const unique = [...new Set(paths)];
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return map;
  data.forEach((entry, i) => {
    if (entry.signedUrl && !entry.error) map.set(unique[i], entry.signedUrl);
  });
  return map;
}

/** Known project names for text-matching news to project imagery. */
export async function loadProjectNames(): Promise<{ id: string; name: string }[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("projects")
    .select("id,name")
    .eq("organization_id", ORG_ID)
    .limit(200);
  if (error || !data) return null;
  return (data as { id: string; name: string }[]).filter((p) => p.name);
}

export interface FeaturedProjectRow {
  projectId: string;
  name: string;
  developer: string | null;
  category: string | null;
  availableUnits: number;
  startingPriceOmr: number | null;
  unitTypes: string[];
}

/** Projects with live availability for the featured-project cards. */
export async function loadFeaturedProjects(limit = 3): Promise<FeaturedProjectRow[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("units")
    .select("project_id,unit_type,price_omr,status,projects(id,name,developer,category)")
    .eq("organization_id", ORG_ID)
    .eq("status", "available")
    .not("price_omr", "is", null)
    .not("reference_id", "ilike", "UNMATCHED%")
    .limit(1000);
  if (error || !data) return null;

  const byProject = new Map<string, FeaturedProjectRow>();
  for (const r of data as unknown as {
    project_id: string | null;
    unit_type: string | null;
    price_omr: number | string | null;
    projects: { id: string; name: string; developer: string | null; category: string | null } | null;
  }[]) {
    if (!r.project_id || !r.projects) continue;
    const price = r.price_omr == null ? null : Number(r.price_omr) || null;
    const row = byProject.get(r.project_id) ?? {
      projectId: r.project_id,
      name: r.projects.name,
      developer: r.projects.developer,
      category: r.projects.category,
      availableUnits: 0,
      startingPriceOmr: null,
      unitTypes: [],
    };
    row.availableUnits += 1;
    if (price != null && price > 0 && (row.startingPriceOmr == null || price < row.startingPriceOmr)) {
      row.startingPriceOmr = price;
    }
    if (r.unit_type && !row.unitTypes.includes(r.unit_type) && row.unitTypes.length < 4) {
      row.unitTypes.push(r.unit_type);
    }
    byProject.set(r.project_id, row);
  }
  return [...byProject.values()]
    .sort((a, b) => b.availableUnits - a.availableUnits || a.name.localeCompare(b.name))
    .slice(0, limit);
}
