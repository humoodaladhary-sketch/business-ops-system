// Approximate boundary polygons for Oman's key real-estate zones, so the map can
// SHADE each area (not just drop pins) and carry a short presentation brief.
//
// ⚠️ ILLUSTRATIVE presentation boundaries — rough extents for orientation and
// pitching, NOT survey-accurate cadastral limits. Rings are [lat, lng].

export interface ZoneBoundary {
  id: string;
  name: string;
  kind: "itc" | "future_city" | "surooh";
  ownershipEligibility: "all_nationalities" | "gcc_omani_only";
  /** 1–2 sentence, presentation-ready description (no invented prices/figures). */
  brief: string;
  ring: [number, number][];
}

// A rough hexagon around a centre — dLat/dLng are half-extents in degrees
// (~0.01 deg ≈ 1.1 km). Purely illustrative shaping.
function ring(lat: number, lng: number, dLat: number, dLng: number): [number, number][] {
  return [
    [lat + dLat, lng],
    [lat + dLat * 0.5, lng + dLng],
    [lat - dLat * 0.5, lng + dLng],
    [lat - dLat, lng],
    [lat - dLat * 0.5, lng - dLng],
    [lat + dLat * 0.5, lng - dLng],
  ];
}

export const ZONE_BOUNDARIES: ZoneBoundary[] = [
  // ── ITC — freehold, all nationalities (foreign-investor + residency story) ──
  {
    id: "al-mouj",
    name: "Al Mouj Muscat",
    kind: "itc",
    ownershipEligibility: "all_nationalities",
    brief:
      "Oman's flagship integrated marina community on the Seeb coast — golf, marina and beachfront living. ITC freehold, open to all nationalities, with Golden/Investor Residency eligibility.",
    ring: ring(23.61, 58.27, 0.018, 0.032),
  },
  {
    id: "yiti-aida",
    name: "Yiti — AIDA & Sustainable City",
    kind: "itc",
    ownershipEligibility: "all_nationalities",
    brief:
      "The Yiti coastal destination — Dar Global's AIDA (Trump-branded) and Diamond's Sustainable City. ITC freehold for all nationalities; a strong foreign-investor and residency proposition.",
    ring: ring(23.515, 58.645, 0.028, 0.038),
  },
  {
    id: "muscat-bay",
    name: "Muscat Bay — Bandar Jissah",
    kind: "itc",
    ownershipEligibility: "all_nationalities",
    brief:
      "Saraya's cliffside resort community at Bandar Jissah, between Muscat and the Eastern mountains. ITC freehold, all nationalities, residency-eligible.",
    ring: ring(23.52, 58.75, 0.015, 0.022),
  },
  {
    id: "jebel-sifah",
    name: "Jebel Sifah",
    kind: "itc",
    ownershipEligibility: "all_nationalities",
    brief:
      "Muriya's marina resort town at Jebel Sifah, roughly 40 minutes south of Muscat. ITC freehold, open to foreign investors and residency.",
    ring: ring(23.42, 58.88, 0.02, 0.026),
  },
  {
    id: "muscat-hills",
    name: "Muscat Hills",
    kind: "itc",
    ownershipEligibility: "all_nationalities",
    brief:
      "Inland golf-and-residence enclave (Opal, Golf Hills/The Pearl). ITC freehold, all nationalities.",
    ring: ring(23.58, 58.42, 0.014, 0.02),
  },
  {
    id: "shatti-qurum",
    name: "Shatti Al Qurum",
    kind: "itc",
    ownershipEligibility: "all_nationalities",
    brief:
      "Prime Muscat seafront district — the Residences at Mandarin Oriental. ITC freehold branded residences, open to all nationalities.",
    ring: ring(23.61, 58.49, 0.01, 0.02),
  },

  // ── Future Cities — freehold for Omani / GCC ONLY (no foreign residency pitch) ──
  {
    id: "sultan-haitham-city",
    name: "Sultan Haitham City",
    kind: "future_city",
    ownershipEligibility: "gcc_omani_only",
    brief:
      "Oman's landmark Future City south-west of Seeb, home to the Wadi Zaha flagship and several Future-City communities. Freehold for Omani and GCC nationals ONLY — do not pitch foreign ownership or residency here.",
    ring: ring(23.56, 58.17, 0.045, 0.09),
  },

  // ── Surooh — freehold for Omani / GCC ONLY ──
  {
    id: "surooh-barka",
    name: "Surooh — Barka (Hay Al Naseem)",
    kind: "surooh",
    ownershipEligibility: "gcc_omani_only",
    brief:
      "Surooh integrated residential community in Barka, Al Batinah South. Omani/GCC ownership only — not for foreign investors.",
    ring: ring(23.7, 57.89, 0.02, 0.03),
  },
  {
    id: "surooh-sohar",
    name: "Surooh — Sohar (Hay Al Majd)",
    kind: "surooh",
    ownershipEligibility: "gcc_omani_only",
    brief:
      "Surooh residential community in Sohar, Al Batinah North. Omani/GCC ownership only — not for foreign investors.",
    ring: ring(24.34, 56.71, 0.02, 0.03),
  },
];

// Fill/stroke colour per zone kind (concrete hex — Leaflet path attributes don't
// resolve CSS vars). ITC uses the brand gold; the two GCC/Omani-only kinds get
// distinct muted colours so they read apart at a glance.
export const ZONE_COLORS: Record<ZoneBoundary["kind"], string> = {
  itc: "#D7A52C", // brand gold — all nationalities
  future_city: "#4F7CAC", // steel blue — Sultan Haitham City (GCC/Omani)
  surooh: "#9E6D7C", // muted rose — Surooh (GCC/Omani)
};

export const ZONE_KIND_LABEL: Record<ZoneBoundary["kind"], string> = {
  itc: "ITC — all nationalities",
  future_city: "Future City — GCC/Omani",
  surooh: "Surooh — GCC/Omani",
};
