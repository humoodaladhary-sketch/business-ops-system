/**
 * Oman market context used across all AI prompts. Hand-curated; review
 * periodically with Humood.
 *
 * Keep this file small and factual. Prompts import from here so the same
 * source of truth drives listings, buyer prediction, and ROI scoring.
 */

export const ITC_ZONES: Array<{
  zone: string;
  project_hint?: string;
  status: "freehold_itc";
  notes: string;
}> = [
  {
    zone: "Sultan Haitham City - Phase 1",
    project_hint: "SHC",
    status: "freehold_itc",
    notes: "Government-backed smart city south of Muscat. Infrastructure pipeline active.",
  },
  {
    zone: "AIDA",
    status: "freehold_itc",
    notes: "Luxury ITC development in Yiti, cliffside views, premium positioning.",
  },
  {
    zone: "Al Mouj Muscat",
    status: "freehold_itc",
    notes: "Established marina + golf integrated community, mature resale market.",
  },
  {
    zone: "Muscat Hills",
    status: "freehold_itc",
    notes: "Early-gen ITC; gated community with golf course.",
  },
  {
    zone: "Muscat Bay",
    status: "freehold_itc",
    notes: "Boutique coastal ITC, low-density, Jumeirah-managed residences.",
  },
  {
    zone: "Hawana Salalah",
    status: "freehold_itc",
    notes: "Dhofar region ITC, seasonal tourism demand, distinct from Muscat market.",
  },
];

/** Gross rental yield bands (2025 working assumptions for investment stock). */
export const MUSCAT_YIELD_BANDS: Record<string, { low: number; high: number }> = {
  studio: { low: 7.5, high: 9.5 },
  apartment: { low: 7.0, high: 9.0 },
  townhouse: { low: 6.0, high: 8.0 },
  villa: { low: 5.0, high: 7.0 },
  sky_villa: { low: 5.5, high: 7.5 },
  penthouse: { low: 5.0, high: 7.0 },
  duplex: { low: 6.0, high: 8.0 },
};

/** Adjustments applied on top of the base band. */
export const YIELD_ADJUSTMENTS = {
  itc_premium_pp: 0.5, // ITC eligibility draws foreign money, tighter market
  sultan_haitham_pp: 0.5, // appreciation premium; slight yield compression
  sea_view_pp: 0.5,
  off_plan_liquidity_penalty: -1, // 1–10 scale
};

export const CONTACT = {
  brand_name: "Alwalaa Real Estate",
  brand_name_ar: "الولاء العقارية",
  whatsapp: process.env.NEXT_PUBLIC_ALWALAA_WHATSAPP ?? "+968 0000 0000",
  email: process.env.NEXT_PUBLIC_ALWALAA_EMAIL ?? "info@alwalaa.om",
};

/** Approved CTA copy — bilingual. AI may pick from these; must never invent new ones. */
export const APPROVED_CTAS = {
  en: [
    "Request the investor pack",
    "Book a private viewing",
    "Reserve your residence today",
    "Speak with an Alwalaa advisor",
    "Get the full payment plan",
  ],
  ar: [
    "اطلب الكتيب الاستثماري",
    "احجز معاينة خاصة",
    "احجز وحدتك الآن",
    "تواصل مع مستشار الولاء",
    "اطلب خطة الدفع الكاملة",
  ],
};

/** Forbidden words — tone guardrails. */
export const FORBIDDEN = [
  "bargain",
  "deal of the century",
  "don't miss out",
  "hot property",
  "hurry",
  "limited time!",
  "!!!",
];
