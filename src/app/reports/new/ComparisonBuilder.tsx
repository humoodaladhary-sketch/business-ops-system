"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface UnitLite {
  id: string;
  reference_id: string;
  unit_type: string;
  bedrooms: number | null;
  area_sqm: number | null;
  price_omr: number | null;
  ownership_type: string;
}

export function ComparisonBuilder({ units }: { units: UnitLite[] }) {
  const router = useRouter();
  const [brief, setBrief] = useState(
    "European investor, residency-linked freehold, under OMR 150k, 2BR, yield ≥ 7%.",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit() {
    if (selected.length < 2) {
      setError("Pick at least 2 units to compare.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const resp = await fetch("/api/reports/comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitIds: selected, clientBrief: brief }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Report failed");
      router.push(`/reports/${body.reportId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">1. Client brief</h2>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          className="w-full border border-[var(--color-brand-gray-200)] rounded-sm px-3 py-2 text-sm"
        />
      </section>

      <section className="card p-5 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-display text-lg">2. Pick units to compare</h2>
          <div className="text-sm text-[var(--color-brand-gray-500)]">
            {selected.length} selected
          </div>
        </div>
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
          {units.map((u) => {
            const on = selected.includes(u.id);
            return (
              <label
                key={u.id}
                className={`flex items-center gap-3 p-3 rounded-sm cursor-pointer transition ${
                  on
                    ? "bg-[var(--color-brand-gold)]/20 border border-[var(--color-brand-gold)]"
                    : "hover:bg-[var(--color-brand-gray-50)] border border-[var(--color-brand-gray-200)]"
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(u.id)} />
                <div className="flex-1">
                  <div className="font-mono text-xs text-[var(--color-brand-gray-500)]">{u.reference_id}</div>
                  <div className="text-sm">
                    {u.bedrooms}BR {u.unit_type.replace("_", " ")}
                    {u.area_sqm ? ` · ${u.area_sqm} sqm` : ""}
                  </div>
                </div>
                <div className="text-sm">
                  {u.price_omr ? `OMR ${u.price_omr.toLocaleString()}` : "—"}
                  {u.ownership_type === "freehold_itc" && (
                    <span className="badge badge-gold ml-2">ITC</span>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <button className="btn-gold" disabled={busy} onClick={submit}>
        {busy ? "Building report…" : "Build comparison report"}
      </button>
    </div>
  );
}
