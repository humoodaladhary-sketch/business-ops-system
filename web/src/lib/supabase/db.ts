/**
 * Typed DB query helpers. Every API route goes through these so the
 * organization scoping and RLS-friendly field shapes are consistent.
 *
 * Organization handling: MVP is single-tenant. On first DB touch we
 * create a default organization and return its id. When auth lands, this
 * gets replaced by reading the caller's org from the JWT.
 */

import type {
  BuyerProfile,
  ComparisonReport,
  Listing,
  Project,
  RoiScores,
  Unit,
  UnitField,
} from "@/types";
import { supabaseServer } from "./server";

const DEFAULT_ORG_NAME = "Alwalaa Real Estate";

/** Ensures a default organization exists and returns its id. */
export async function getOrCreateDefaultOrgId(): Promise<string> {
  const sb = supabaseServer();
  const { data: existing } = await sb
    .from("organizations")
    .select("id")
    .eq("name", DEFAULT_ORG_NAME)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await sb
    .from("organizations")
    .insert({ name: DEFAULT_ORG_NAME })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create organization: ${error.message}`);
  return created.id as string;
}

// ---------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------

export async function insertProject(args: {
  organization_id: string;
  name: string;
  developer?: string | null;
  zone?: string | null;
  ownership_type?: "freehold_itc" | "usufruct" | "leasehold" | "unknown";
  handover_date?: string | null;
}): Promise<Project> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("projects").insert(args).select("*").single();
  if (error) throw new Error(`Insert project failed: ${error.message}`);
  return data as Project;
}

export async function listProjects(organization_id: string) {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .eq("organization_id", organization_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

// ---------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------

export async function upsertUnit(args: Partial<Unit> & {
  organization_id: string;
  project_id: string;
  reference_id: string;
  unit_type: string;
}): Promise<Unit> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("units")
    .upsert(args, { onConflict: "project_id,reference_id" })
    .select("*")
    .single();
  if (error) throw new Error(`Upsert unit failed: ${error.message}`);
  return data as Unit;
}

export async function getUnit(id: string): Promise<Unit | null> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("units").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Unit | null) ?? null;
}

export async function listUnits(args: {
  organization_id: string;
  project_id?: string;
  onlyItc?: boolean;
}): Promise<Unit[]> {
  const sb = supabaseServer();
  let q = sb
    .from("units")
    .select("*")
    .eq("organization_id", args.organization_id)
    .order("created_at", { ascending: false });
  if (args.project_id) q = q.eq("project_id", args.project_id);
  if (args.onlyItc) q = q.eq("ownership_type", "freehold_itc");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Unit[];
}

// ---------------------------------------------------------------------
// Unit fields (source-tagged audit trail)
// ---------------------------------------------------------------------

export async function replaceUnitFields(
  unit_id: string,
  fields: Array<Omit<UnitField, "id" | "unit_id">>,
): Promise<void> {
  const sb = supabaseServer();
  await sb.from("unit_fields").delete().eq("unit_id", unit_id);
  if (fields.length === 0) return;
  const rows = fields.map((f) => ({ unit_id, ...f }));
  const { error } = await sb.from("unit_fields").insert(rows);
  if (error) throw new Error(`Insert unit_fields failed: ${error.message}`);
}

export async function listUnitFields(unit_id: string): Promise<UnitField[]> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("unit_fields").select("*").eq("unit_id", unit_id);
  if (error) throw new Error(error.message);
  return (data ?? []) as UnitField[];
}

// ---------------------------------------------------------------------
// ROI + Buyer
// ---------------------------------------------------------------------

export async function upsertRoi(unit_id: string, roi: Omit<RoiScores, "unit_id">, modelVersion: string) {
  const sb = supabaseServer();
  const { error } = await sb
    .from("roi_scores")
    .upsert({ unit_id, ...roi, model_version: modelVersion }, { onConflict: "unit_id" });
  if (error) throw new Error(`Upsert ROI failed: ${error.message}`);
}

export async function getRoi(unit_id: string): Promise<RoiScores | null> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("roi_scores").select("*").eq("unit_id", unit_id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RoiScores | null) ?? null;
}

export async function upsertBuyer(unit_id: string, buyer: Omit<BuyerProfile, "unit_id">, modelVersion: string) {
  const sb = supabaseServer();
  const { error } = await sb
    .from("buyer_profiles")
    .upsert({ unit_id, ...buyer, model_version: modelVersion }, { onConflict: "unit_id" });
  if (error) throw new Error(`Upsert buyer failed: ${error.message}`);
}

export async function getBuyer(unit_id: string): Promise<BuyerProfile | null> {
  const sb = supabaseServer();
  const { data, error } = await sb.from("buyer_profiles").select("*").eq("unit_id", unit_id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BuyerProfile | null) ?? null;
}

// ---------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------

export async function upsertListing(args: {
  organization_id: string;
  unit_id: string;
  platform: string;
  language: string;
  title: string;
  body: string;
  cta?: string | null;
  hashtags?: string[];
  warnings?: string[];
  model_version?: string;
  prompt_hash?: string;
}) {
  const sb = supabaseServer();
  const { error } = await sb
    .from("listings")
    .upsert(args, { onConflict: "unit_id,platform,language" });
  if (error) throw new Error(`Upsert listing failed: ${error.message}`);
}

export async function listListings(unit_id: string): Promise<Listing[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("listings")
    .select("*")
    .eq("unit_id", unit_id)
    .order("platform", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Listing[];
}

export async function updateListingBody(id: string, body: string, title?: string) {
  const sb = supabaseServer();
  const patch: Record<string, unknown> = { body, edited_by_human: true, edited_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  const { error } = await sb.from("listings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------

export async function insertReport(args: {
  organization_id: string;
  type: "comparison" | "investor" | "pitch";
  title?: string | null;
  input_filter?: object | null;
  unit_ids: string[];
  body_markdown?: string | null;
  whatsapp_pitch?: string | null;
  model_version?: string;
}) {
  const sb = supabaseServer();
  const { data, error } = await sb.from("reports").insert(args).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getReport(id: string) {
  const sb = supabaseServer();
  const { data, error } = await sb.from("reports").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listReports(organization_id: string) {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("reports")
    .select("*")
    .eq("organization_id", organization_id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------
// Aggregate dashboard counts
// ---------------------------------------------------------------------

export async function dashboardCounts(organization_id: string) {
  const sb = supabaseServer();
  const [projects, units, listings, reports] = await Promise.all([
    sb.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", organization_id),
    sb.from("units").select("id", { count: "exact", head: true }).eq("organization_id", organization_id),
    sb.from("listings").select("id", { count: "exact", head: true }).eq("organization_id", organization_id),
    sb.from("reports").select("id", { count: "exact", head: true }).eq("organization_id", organization_id),
  ]);
  return {
    projects: projects.count ?? 0,
    units: units.count ?? 0,
    listings: listings.count ?? 0,
    reports: reports.count ?? 0,
  };
}
