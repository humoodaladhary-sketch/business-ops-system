// Compact Oman opportunity map for the portal rail: the stylized silhouette
// with live project pins from the ITC catalog (verified coordinates already
// used by the full leaflet map). Gold = ITC (all nationalities), slate =
// GCC/Omani-only. Links into Pro Mode's full ITC map. Server-safe SVG — no
// leaflet payload on the portal. Clearly labeled stylized, never presented
// as a survey map, and shows no market data it does not have.
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ITC_PROJECTS } from "../../_data/itc-zones";
import { MUSANDAM_PATH, OMAN_PATH, OMAN_VIEWBOX, projectOman } from "./omanOutline";

export function OmanMiniMap() {
  const pins = ITC_PROJECTS.map((p) => ({
    name: p.name,
    open: p.ownershipEligibility === "all_nationalities",
    ...projectOman(p.lat, p.lng),
  }));
  const openCount = pins.filter((p) => p.open).length;

  return (
    <div className="rounded-2xl border border-[#15131114] bg-white/70 p-5 shadow-sm">
      <h2 className="font-heading text-xl">Oman opportunity map</h2>
      <p className="mt-0.5 text-[11px] text-[#151311a6]">
        {pins.length} tracked projects · {openCount} open to all nationalities (ITC)
      </p>
      <svg
        viewBox={OMAN_VIEWBOX}
        role="img"
        aria-label={`Stylized Oman map with ${pins.length} project markers, concentrated around Muscat`}
        className="mt-3 h-44 w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <path d={OMAN_PATH} fill="#15131108" stroke="#9C6B3B" strokeWidth="1" strokeOpacity="0.5" />
        <path d={MUSANDAM_PATH} fill="#15131108" stroke="#9C6B3B" strokeWidth="1" strokeOpacity="0.5" />
        {pins.map((p) => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r="5" fill={p.open ? "#D7A52C22" : "#64748b22"}>
              <title>{`${p.name} — ${p.open ? "ITC · all nationalities" : "GCC/Omani only"}`}</title>
            </circle>
            <circle cx={p.x} cy={p.y} r="2.1" fill={p.open ? "#D7A52C" : "#64748b"} />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] text-[#151311a6]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#D7A52C]" /> ITC · all nationalities
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#64748b]" /> GCC/Omani
          </span>
        </div>
        <Link href="/war-room" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9C6B3B] hover:underline">
          Full ITC map <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-1.5 text-[10px] text-[#15131166]">Stylized silhouette — open the full map for zones and briefs.</p>
    </div>
  );
}
