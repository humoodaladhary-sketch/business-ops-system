"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Swords, Calculator, FileText, Map as MapIcon } from "lucide-react";
import { Calculators } from "./_components/Calculators";
import { OfferBuilder } from "./_components/OfferBuilder";
import { ITC_PROJECTS } from "../_data/itc-zones";
import type { OfferUnit } from "@/domain/realestate/offer";
import { cn } from "../lib/cn";

// Leaflet is client-only — load the map without SSR.
const ItcMap = dynamic(() => import("./_components/ItcMap").then((m) => m.ItcMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-[70vh] min-h-[380px] place-items-center rounded-2xl border border-hairline text-sm text-white/40">
      Loading map…
    </div>
  ),
});

// Prefill the offer's unit picker from the signed ITC catalog so eligibility +
// category are always correct; the owner fills reference / price / area per unit.
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
  { id: "calc", label: "Calculators", icon: Calculator },
  { id: "map", label: "ITC Map", icon: MapIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WarRoom() {
  const [tab, setTab] = useState<TabId>("offer");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-ink-900/50 text-gold">
          <Swords className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold/70">Pro · Closing mode</p>
          <h1 className="font-heading text-3xl text-white">War Room</h1>
          <p className="text-sm text-white/50">Match a unit, run the numbers, generate the offer — everything to close, in one place.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
              tab === t.id ? "border-gold/50 bg-gold/15 text-gold" : "border-hairline text-white/60 hover:text-white",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "offer" && <OfferBuilder units={CATALOG_UNITS} />}
      {tab === "calc" && <Calculators />}
      {tab === "map" && <ItcMap />}
    </div>
  );
}
