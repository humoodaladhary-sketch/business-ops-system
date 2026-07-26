"use client";

// Pro Mode workspace (route: /war-room). Tabs: Offer, Compare, Calculators,
// ITC Map. Live inventory arrives from the server page; the header carries the
// refreshed Pro look — a deep-garnet banner in the portal design language.
import { useState } from "react";
import dynamic from "next/dynamic";
import { Swords, Calculator, FileText, Map as MapIcon, Scale } from "lucide-react";
import { Calculators } from "./Calculators";
import { OfferBuilder } from "./OfferBuilder";
import { CompareBuilder } from "./CompareBuilder";
import { ITC_PROJECTS } from "../../_data/itc-zones";
import type { LiveOfferUnit } from "../../_data/warRoomUnits";
import type { OfferUnit } from "@/domain/realestate/offer";
import { cn } from "../../lib/cn";

// Leaflet is client-only — load the map without SSR.
const ItcMap = dynamic(() => import("./ItcMap").then((m) => m.ItcMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[70vh] min-h-[380px] place-items-center rounded-2xl border border-hairline text-sm text-white/40">
      Loading map…
    </div>
  ),
});

// Catalog fallback for manual offers when live inventory is unreachable —
// eligibility + category always correct; the owner fills unit facts per deal.
const CATALOG_UNITS: OfferUnit[] = ITC_PROJECTS.map((p) => ({
  reference: "",
  project: p.name,
  developer: p.developer,
  unitType: "",
  areaSqm: 0,
  priceOmr: 0,
  category: p.category,
  ownershipEligibility: p.ownershipEligibility,
}));

const TABS = [
  { id: "offer", label: "Offer", icon: FileText },
  { id: "compare", label: "Compare", icon: Scale },
  { id: "calc", label: "Calculators", icon: Calculator },
  { id: "map", label: "ITC Map", icon: MapIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function WarRoomClient({ liveUnits }: { liveUnits: LiveOfferUnit[] }) {
  const [tab, setTab] = useState<TabId>("offer");

  return (
    <div className="space-y-5">
      {/* Pro banner — portal hero language in the closing-mode palette */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2A1114] via-[#1A0F10] to-[#0F0D0B] p-6 shadow-xl sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">
              <Swords className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold/75">Closing mode</p>
              <h1 className="font-heading text-3xl text-white sm:text-4xl">Pro Mode</h1>
              <p className="mt-1 text-sm text-white/55">
                Match a unit, compare the shortlist, run the numbers, generate the offer — everything to close.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
            {liveUnits.length > 0 ? `${liveUnits.length} live units` : "Manual entry"}
          </span>
        </div>

        {/* Tabs inside the banner */}
        <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pro Mode tools">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                tab === t.id
                  ? "border-transparent bg-gold text-ink shadow"
                  : "border-white/15 text-white/60 hover:border-gold/40 hover:text-white",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "offer" && <OfferBuilder liveUnits={liveUnits} catalog={CATALOG_UNITS} />}
      {tab === "compare" && <CompareBuilder liveUnits={liveUnits} />}
      {tab === "calc" && <Calculators />}
      {tab === "map" && <ItcMap />}
    </div>
  );
}
