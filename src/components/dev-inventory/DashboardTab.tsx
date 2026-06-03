"use client";

import { useEffect, useState } from "react";
import { formatOmr, formatPct, formatPerSqm } from "@/domain/inventory/money";
import type {
  CategoryExtremes,
  Kpis,
  ProjectComparison,
  ProjectPriceBand,
  ProjectPricePerSqm,
  UnitTypeShare,
} from "@/domain/inventory/analytics";
import type { PriceMovement } from "@/storage/inventory/InventoryRepository";

interface AnalyticsResponse {
  kpis: Kpis;
  extremesByUnitType: CategoryExtremes[];
  extremesByProject: CategoryExtremes[];
  pricePerSqmByProject: ProjectPricePerSqm[];
  priceBandByProject: ProjectPriceBand[];
  unitTypeDistribution: UnitTypeShare[];
  comparisonMatrix: ProjectComparison[];
  recentMovements: PriceMovement[];
  error?: string;
}

export function DashboardTab() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((b: AnalyticsResponse) => (b.error ? setErr(b.error) : setData(b)))
      .catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <div className="card p-6 text-sm text-red-800">{err}</div>;
  if (!data) return <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">Loading analytics…</div>;
  if (data.kpis.totalUnits === 0) {
    return <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">No units yet — ingest inventory first.</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Units" value={String(data.kpis.totalUnits)} />
        <Kpi label="Total value" value={formatOmr(data.kpis.totalValueOMR)} />
        <Kpi label="Avg /sqm" value={formatPerSqm(data.kpis.avgPricePerSqm)} />
        <Kpi label="Projects" value={String(data.kpis.projectCount)} />
        <Kpi label="Available" value={String(data.kpis.availableCount)} />
      </section>

      {/* Price band per project */}
      <Panel title="Price band per project">
        <BandTable rows={data.priceBandByProject} perSqm={data.pricePerSqmByProject} />
      </Panel>

      {/* Lowest vs highest per category */}
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Lowest vs highest — by unit type">
          <ExtremesList rows={data.extremesByUnitType} />
        </Panel>
        <Panel title="Lowest vs highest — by project">
          <ExtremesList rows={data.extremesByProject} />
        </Panel>
      </div>

      {/* Distribution + comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Unit-type distribution">
          <div className="space-y-2">
            {data.unitTypeDistribution.map((d) => (
              <div key={d.unitType}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span>{d.unitType}</span>
                  <span className="text-[var(--color-brand-gray-500)]">{d.count} · {d.pct}%</span>
                </div>
                <div className="h-2 bg-[var(--color-brand-gray-200)] rounded-sm overflow-hidden">
                  <div className="h-full bg-[var(--color-brand-gold)]" style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Project comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">
                  <th className="py-1">Project</th><th>Units</th><th>Avg price</th><th>Avg /sqm</th><th>Avail.</th>
                </tr>
              </thead>
              <tbody>
                {data.comparisonMatrix.map((m) => (
                  <tr key={m.project} className="border-t border-[var(--color-brand-gray-200)]">
                    <td className="py-1.5">{m.project}</td>
                    <td>{m.count}</td>
                    <td>{formatOmr(m.avgPrice)}</td>
                    <td>{formatPerSqm(m.avgPriceSqm)}</td>
                    <td>{m.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Movements */}
      <Panel title="Recent price movements (30 days)">
        {data.recentMovements.length === 0 ? (
          <p className="text-sm text-[var(--color-brand-gray-500)]">No price changes recorded yet. Re-ingest with updated prices to populate this.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">
                <th className="py-1">When</th><th>Project</th><th>Unit</th><th>Old</th><th>New</th><th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {data.recentMovements.map((m, i) => (
                <tr key={`${m.id}-${i}`} className="border-t border-[var(--color-brand-gray-200)]">
                  <td className="py-1.5">{new Date(m.at).toLocaleDateString()}</td>
                  <td>{m.project}</td>
                  <td className="font-mono text-xs">{m.unitRef}</td>
                  <td>{formatOmr(m.oldPrice)}</td>
                  <td>{formatOmr(m.newPrice)}</td>
                  <td className={m.deltaPct >= 0 ? "text-emerald-700" : "text-red-700"}>{formatPct(m.deltaPct, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xl font-display">{value}</div>
      <div className="text-xs text-[var(--color-brand-gray-500)] uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-display text-lg mb-3">{title}</h2>
      {children}
    </section>
  );
}

function BandTable({ rows, perSqm }: { rows: ProjectPriceBand[]; perSqm: ProjectPricePerSqm[] }) {
  const sqmMap = new Map(perSqm.map((p) => [p.project, p.avgPricePerSqm]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">
            <th className="py-1">Project</th><th>Min</th><th>Avg</th><th>Max</th><th>Avg /sqm</th><th>Units</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.project} className="border-t border-[var(--color-brand-gray-200)]">
              <td className="py-1.5">{b.project}</td>
              <td>{formatOmr(b.min)}</td>
              <td>{formatOmr(b.avg)}</td>
              <td>{formatOmr(b.max)}</td>
              <td>{formatPerSqm(sqmMap.get(b.project) ?? null)}</td>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExtremesList({ rows }: { rows: CategoryExtremes[] }) {
  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.category} className="flex justify-between items-center border-b border-[var(--color-brand-gray-200)] pb-1.5 last:border-0">
          <div>
            <div className="font-medium">{r.category}</div>
            <div className="text-xs text-[var(--color-brand-gray-500)]">
              {r.minUnitRef ?? "—"} → {r.maxUnitRef ?? "—"}
            </div>
          </div>
          <div className="text-right">
            <div>{formatOmr(r.minPriceOMR)} – {formatOmr(r.maxPriceOMR)}</div>
            <div className="text-xs text-[var(--color-brand-gold)]">spread {formatPct(r.spreadPct)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
