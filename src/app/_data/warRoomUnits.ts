// Server-side loader for Pro Mode: the real, sellable inventory with the
// project catalog's authoritative category + ownership eligibility joined in.
// Only priced, available, matched units are offered for prefill/comparison —
// review-only rows (UNMATCHED-*) and unpriced units never reach a client tool.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "../_departments/config";
import type { OfferUnit } from "@/domain/realestate/offer";

export interface LiveOfferUnit extends OfferUnit {
  bedrooms: number | null;
  status: string;
}

interface Row {
  reference_id: string;
  unit_number: string | null;
  unit_type: string | null;
  bedrooms: number | null;
  area_sqm: number | string | null;
  price_omr: number | string | null;
  status: string;
  projects: {
    name: string;
    developer: string | null;
    category: string | null;
    ownership_eligibility: string | null;
  } | null;
}

const num = (v: number | string | null): number => (v == null ? 0 : Number(v) || 0);

export async function loadLiveOfferUnits(): Promise<LiveOfferUnit[] | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("units")
    .select(
      "reference_id,unit_number,unit_type,bedrooms,area_sqm,price_omr,status,projects(name,developer,category,ownership_eligibility)",
    )
    .eq("organization_id", ORG_ID)
    .eq("status", "available")
    .not("price_omr", "is", null)
    .not("reference_id", "ilike", "UNMATCHED%")
    .order("reference_id");
  if (error || !data) return null;

  return (data as unknown as Row[])
    .filter((r) => num(r.price_omr) > 0 && r.projects)
    .map((r) => ({
      reference: r.reference_id,
      project: r.projects!.name,
      developer: r.projects!.developer ?? "",
      unitType: [r.unit_type, r.unit_number].filter(Boolean).join(" · "),
      areaSqm: num(r.area_sqm),
      priceOmr: num(r.price_omr),
      // The catalog is authoritative. A project missing its catalog row is
      // treated as GCC-only — never accidentally pitchable to a non-GCC client.
      category: (r.projects!.category ?? "future_cities") as OfferUnit["category"],
      ownershipEligibility: (r.projects!.ownership_eligibility ?? "gcc_omani_only") as OfferUnit["ownershipEligibility"],
      bedrooms: r.bedrooms,
      status: r.status,
    }));
}
