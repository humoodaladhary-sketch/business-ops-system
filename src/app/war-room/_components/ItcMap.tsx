"use client";

// Interactive Oman ITC-zones map for Alwalaa's Pro / War-Room mode.
//
// Consumed via `next/dynamic(() => import("./_components/ItcMap"), { ssr: false })`,
// so leaflet only ever runs in the browser. We still keep every leaflet *call*
// (L.divIcon, etc.) inside the component so nothing touches `window` at module
// scope — only the pure SVG-string helper lives up here.
//
// Tiles: free OpenStreetMap raster tiles (no API key, no token).

import "leaflet/dist/leaflet.css";

import { useMemo } from "react";
import { MapContainer, Marker, Polygon, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";

import { ITC_PROJECTS } from "@/app/_data/itc-zones";
import { ZONE_BOUNDARIES, ZONE_COLORS, ZONE_KIND_LABEL } from "@/app/_data/itc-zone-boundaries";

// Muscat-centred view of northern Oman.
const CENTER: L.LatLngExpression = [23.6, 58.4];
const ZOOM = 9;

// Eligibility → colour. ITC / all_nationalities uses the CSS var so it follows
// the Pro-mode gold→crimson recolour; gcc_omani_only is a fixed muted slate.
const GOLD_FILL = "fill:rgb(var(--gold))";
const SLATE = "#64748b";
const SLATE_FILL = `fill:${SLATE}`;

// Pure string builder — safe at module scope (no leaflet, no window). Returns a
// teardrop pin whose tip sits at the bottom-centre of a 28×38 box.
function pinSvg(fillStyle: string): string {
  return `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45))"><path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.27 21.73 0 14 0Z" style="${fillStyle};stroke:rgba(255,255,255,0.92);stroke-width:2.5"/><circle cx="14" cy="14" r="5.2" fill="#ffffff" fill-opacity="0.95"/></svg>`;
}

export function ItcMap() {
  // Build the two divIcons once. Because the ITC pin's fill is `rgb(var(--gold))`
  // (a live CSS custom property), toggling Pro-mode recolours the pins without
  // recreating the icons. `className` is set to a custom (non-leaflet) name so
  // leaflet's default `.leaflet-div-icon` white box is never applied.
  const icons = useMemo(() => {
    const make = (fillStyle: string): L.DivIcon =>
      L.divIcon({
        html: pinSvg(fillStyle),
        className: "itc-marker",
        iconSize: [28, 38],
        iconAnchor: [14, 38],
        popupAnchor: [0, -34],
      });
    return { all: make(GOLD_FILL), gcc: make(SLATE_FILL) };
  }, []);

  return (
    <div className="relative h-[70vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-hairline">
      <MapContainer center={CENTER} zoom={ZOOM} scrollWheelZoom className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Shaded zone boundaries — tap for the presentation brief. Rendered
            before the pins so markers stay clickable on top. */}
        {ZONE_BOUNDARIES.map((z) => {
          const color = ZONE_COLORS[z.kind];
          const openToAll = z.ownershipEligibility === "all_nationalities";
          return (
            <Polygon
              key={z.id}
              positions={z.ring as L.LatLngExpression[]}
              pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.14 }}
            >
              <Popup>
                <div style={{ maxWidth: 262 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, color: "#1e293b" }}>
                    {z.name}
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      padding: "2px 9px",
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: openToAll ? "#fbf1d9" : "#eef2f6",
                      border: openToAll ? "1px solid #e6d3a3" : "1px solid #cbd5e1",
                      color: openToAll ? "#7a5c1e" : "#475569",
                    }}
                  >
                    {ZONE_KIND_LABEL[z.kind]}
                  </span>
                  <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.4, color: "#475569" }}>
                    {z.brief}
                  </p>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {ITC_PROJECTS.map((p) => {
          const openToAll = p.ownershipEligibility === "all_nationalities";
          const badge = openToAll
            ? { background: "#fbf1d9", border: "1px solid #e6d3a3", color: "#7a5c1e" }
            : { background: "#eef2f6", border: "1px solid #cbd5e1", color: "#475569" };

          return (
            <Marker
              key={`${p.name}-${p.lat}-${p.lng}`}
              position={[p.lat, p.lng] as L.LatLngExpression}
              icon={openToAll ? icons.all : icons.gcc}
            >
              {/* Leaflet's default popup is dark-on-light; inline styles keep it
                  readable regardless of the app's dark theme / Tailwind preflight. */}
              <Popup>
                <div style={{ maxWidth: 244 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      lineHeight: 1.25,
                      color: "#1e293b",
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "#64748b" }}>
                    {p.developer}
                  </div>

                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      padding: "2px 9px",
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      ...badge,
                    }}
                  >
                    {openToAll ? "All nationalities — ITC" : "GCC/Omani only"}
                  </span>

                  <ul
                    style={{
                      margin: "8px 0 0",
                      paddingLeft: "1.1rem",
                      listStyleType: "disc",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {p.talkingPoints.map((point, i) => (
                      <li
                        key={i}
                        style={{ fontSize: 12, lineHeight: 1.35, color: "#475569" }}
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend overlay — sits above the map (leaflet controls top out ~1000).
          pointer-events-none so it never intercepts map drag/zoom. */}
      <div className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-xl border border-hairline bg-ink-100/90 px-3 py-2.5 text-[11px] leading-tight text-white/85 shadow-lg backdrop-blur">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
          Zones
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#D7A52C" }} />
          <span>ITC — all nationalities</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#4F7CAC" }} />
          <span>Sultan Haitham City</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#9E6D7C" }} />
          <span>Surooh</span>
        </div>
        <div className="mt-2 text-[10px] text-white/45">Pins = projects · tap for details</div>
      </div>
    </div>
  );
}
