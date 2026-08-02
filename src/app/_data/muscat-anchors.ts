// Location anchors for the Invest tab's location intelligence. Coordinates
// are fixed, publicly-verifiable landmark positions (OpenStreetMap, reviewed
// 2026-08). Distances computed from them are OBSERVED geometry — straight-line
// km, deterministic — never market data. Market-rate layers (rents, prices,
// occupancy by area) are NOT derivable from this file and stay "insufficient
// data" until a sourced provider or import supplies them.

export interface LocationAnchor {
  key: string;
  label: string;
  kind: "airport" | "beach" | "business" | "school" | "hospital" | "shopping" | "tourism";
  lat: number;
  lng: number;
}

export const MUSCAT_ANCHORS: LocationAnchor[] = [
  { key: "airport", label: "Muscat International Airport", kind: "airport", lat: 23.5933, lng: 58.2844 },
  { key: "qurum_beach", label: "Qurum Beach", kind: "beach", lat: 23.6167, lng: 58.4746 },
  { key: "cbd_ruwi", label: "Ruwi CBD", kind: "business", lat: 23.5988, lng: 58.5439 },
  { key: "al_mouj_marina", label: "Al Mouj Marina", kind: "tourism", lat: 23.6255, lng: 58.2606 },
  { key: "opera_house", label: "Royal Opera House", kind: "tourism", lat: 23.6134, lng: 58.4457 },
  { key: "royal_hospital", label: "The Royal Hospital", kind: "hospital", lat: 23.5665, lng: 58.4009 },
  { key: "mall_of_oman", label: "Mall of Oman", kind: "shopping", lat: 23.5675, lng: 58.4034 },
  { key: "sqhu", label: "Sultan Qaboos University", kind: "school", lat: 23.5895, lng: 58.1664 },
  { key: "abq_seeb", label: "ABQ / international schools cluster (Seeb)", kind: "school", lat: 23.6083, lng: 58.2519 },
  { key: "muttrah_corniche", label: "Muttrah Corniche & Souq", kind: "tourism", lat: 23.6205, lng: 58.5652 },
];

export const ANCHOR_SOURCE = "Landmark coordinates: OpenStreetMap, reviewed 2026-08";
