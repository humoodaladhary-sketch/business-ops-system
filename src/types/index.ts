/**
 * Shared types. Keep in sync with docs/DATABASE_SCHEMA.sql.
 */

export type UnitType =
  | "studio"
  | "apartment"
  | "townhouse"
  | "villa"
  | "sky_villa"
  | "penthouse"
  | "duplex"
  | "land"
  | "office";

export type OwnershipType = "freehold_itc" | "usufruct" | "leasehold" | "unknown";
export type CompletionStatus = "ready" | "off_plan" | "under_construction";
export type ListingIntent = "sale" | "rent";

export type Platform =
  | "property_finder"
  | "olx_oman"
  | "instagram"
  | "whatsapp"
  | "linkedin"
  | "website";

export type Language = "en" | "ar";

export type FieldSource = "extracted" | "inferred" | "assumed" | "missing";

export type BuyerType =
  | "investor"
  | "end_user_family"
  | "luxury"
  | "first_time"
  | "foreign_expat"
  | "gcc_buyer";

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  developer: string | null;
  location: string | null;
  zone: string | null;
  ownership_type: OwnershipType;
  handover_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileRecord {
  id: string;
  project_id: string | null;
  unit_id: string | null;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: "inventory" | "brochure" | "floor_plan" | "render" | "payment_plan" | "other" | null;
  vision_caption: string | null;
  extracted_text: string | null;
  created_at: string;
}

export interface UnitField {
  id: string;
  unit_id: string;
  field_name: string;
  value: string | null;
  source: FieldSource;
  source_file_id: string | null;
  confidence: number | null;
  reasoning: string | null;
}

export interface Unit {
  id: string;
  organization_id: string;
  project_id: string;
  reference_id: string;
  unit_number: string | null;
  name: string | null;
  unit_type: UnitType;
  completion_status: CompletionStatus;
  intent: ListingIntent;
  ownership_type: OwnershipType;
  building: string | null;
  floor: number | null;
  cluster: string | null;
  phase: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  plot_area_sqm: number | null;
  view: string | null;
  parking: number | null;
  price_omr: number | null;
  service_charge_omr_per_sqm: number | null;
  payment_plan: string | null;
  handover_date: string | null;
  amenities: string[];
  features: string[];
  community_features: string[];
  broker_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoiScores {
  unit_id: string;
  rental_yield_low_pct: number;
  rental_yield_high_pct: number;
  demand_strength: number;
  liquidity_score: number;
  roi_score: number;
  appreciation_score: number;
  rationale: {
    rental_yield: string;
    demand_strength: string;
    liquidity_score: string;
    roi_score: string;
    appreciation_score: string;
  };
}

export interface BuyerProfile {
  unit_id: string;
  primary_buyer: BuyerType;
  secondary_buyer: BuyerType | null;
  best_nationalities: string[];
  motivation: string;
  expected_rental_audience: string;
  sales_angle: string;
  objections: Array<{ objection: string; response: string }>;
}

export interface Listing {
  id: string;
  unit_id: string;
  platform: Platform;
  language: Language;
  title: string;
  body: string;
  cta: string | null;
  hashtags: string[];
  warnings: string[];
  edited_by_human: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComparisonReport {
  comparison: {
    columns: string[];
    rows: Array<{
      unit_id: string;
      title: string;
      values: string[];
      pros: string[];
      cons: string[];
    }>;
  };
  recommendation: {
    top_unit_id: string;
    reasoning: string;
  };
  whatsapp_pitch: { en: string; ar: string };
}
