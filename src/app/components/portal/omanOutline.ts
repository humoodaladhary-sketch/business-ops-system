// Stylized Oman outline for branded artwork and the mini-map. This is BRAND
// ART, not cartography — a simplified silhouette on a 200×200 viewBox with a
// plain equirectangular mapping so live project coordinates can be plotted
// onto it. Longitude 52.5–60.2°E → x 0–200 · latitude 26.6–16.4°N → y 0–200.

export const OMAN_VIEWBOX = "0 0 200 200";

/** Main landmass silhouette (stylized). */
export const OMAN_PATH =
  "M91 33 L103 42 L117 52 L143 57 L158 60 L182 73 L191 80 L179 100 L158 125 " +
  "L135 151 L112 171 L75 186 L39 189 L13 194 L8 180 L16 149 L65 129 L82 90 L86 71 L91 51 Z";

/** Musandam exclave (stylized). */
export const MUSANDAM_PATH = "M98 20 L103 6 L96 10 Z";

/** Project a lat/lng into the outline's viewBox coordinates. */
export function projectOman(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - 52.5) / 7.7) * 200;
  const y = ((26.6 - lat) / 10.2) * 200;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}
