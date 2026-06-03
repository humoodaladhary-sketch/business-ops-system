"use client";

import { useCallback, useState } from "react";
import type { Unit } from "@/domain/inventory/unit";
import { IngestTab } from "./IngestTab";
import { InventoryTab } from "./InventoryTab";
import { DashboardTab } from "./DashboardTab";
import { GenerateTab } from "./GenerateTab";

type Tab = "ingest" | "inventory" | "dashboard" | "generate";

const TABS: { id: Tab; label: string }[] = [
  { id: "ingest", label: "Ingest" },
  { id: "inventory", label: "Inventory" },
  { id: "dashboard", label: "Dashboard" },
  { id: "generate", label: "Generate" },
];

export function DevInventoryApp() {
  const [tab, setTab] = useState<Tab>("ingest");
  const [units, setUnits] = useState<Unit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const resp = await fetch("/api/inventory");
    if (resp.ok) {
      const body = (await resp.json()) as { units: Unit[] };
      setUnits(body.units);
      setLoaded(true);
    }
  }, []);

  function go(next: Tab) {
    setTab(next);
    if ((next === "inventory" || next === "dashboard" || next === "generate") && !loaded) {
      void refresh();
    }
  }

  return (
    <div className="space-y-4">
      <nav
        className="flex border-b border-[var(--color-brand-gray-200)] text-sm"
        role="tablist"
        aria-label="Developer inventory sections"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => go(t.id)}
            className={`px-5 py-2.5 uppercase tracking-wider text-xs font-medium transition ${
              tab === t.id
                ? "text-[var(--color-brand-black)] border-b-2 border-[var(--color-brand-gold)]"
                : "text-[var(--color-brand-gray-500)] hover:text-[var(--color-brand-black)]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button onClick={() => void refresh()} className="btn-ghost text-xs ml-auto" title="Reload from store">
          ⟳ Refresh
        </button>
      </nav>

      {tab === "ingest" && <IngestTab onCommitted={() => { void refresh(); go("inventory"); }} />}
      {tab === "inventory" && <InventoryTab units={units} />}
      {tab === "dashboard" && <DashboardTab />}
      {tab === "generate" && <GenerateTab units={units} />}
    </div>
  );
}
