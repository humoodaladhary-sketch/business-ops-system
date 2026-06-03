"use client";

import { useMemo, useState } from "react";
import type { Unit } from "@/domain/inventory/unit";
import { formatOmr, formatPerSqm } from "@/domain/inventory/money";

type SortKey = "project" | "unitType" | "priceOMR" | "sizeSqm" | "pricePerSqm" | "status";

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(units: Unit[]): string {
  const cols: (keyof Unit)[] = [
    "id", "project", "developer", "unitRef", "unitType", "bedrooms", "bathrooms",
    "sizeSqm", "floor", "view", "priceOMR", "pricePerSqm", "status",
    "paymentPlan", "handoverDate", "itcEligible", "furnishing", "notes",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(",");
  const rows = units.map((u) => cols.map((c) => esc(u[c])).join(","));
  return [head, ...rows].join("\n");
}

export function InventoryTab({ units }: { units: Unit[] }) {
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [unitType, setUnitType] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("project");
  const [asc, setAsc] = useState(true);

  const projects = useMemo(() => Array.from(new Set(units.map((u) => u.project))).sort(), [units]);
  const types = useMemo(() => Array.from(new Set(units.map((u) => u.unitType))).sort(), [units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = units.filter((u) => {
      if (project && u.project !== project) return false;
      if (unitType && u.unitType !== unitType) return false;
      if (status && u.status !== status) return false;
      if (q && !`${u.project} ${u.unitRef} ${u.developer} ${u.view ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" || typeof bv === "number") {
        cmp = (Number(av ?? -Infinity)) - (Number(bv ?? -Infinity));
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return asc ? cmp : -cmp;
    });
    return rows;
  }, [units, search, project, unitType, status, sortKey, asc]);

  function sortBy(k: SortKey) {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(true); }
  }

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="p-2 cursor-pointer select-none" onClick={() => sortBy(k)}>
      {label} {sortKey === k ? (asc ? "▲" : "▼") : ""}
    </th>
  );

  if (units.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
        No units yet. Use the <strong>Ingest</strong> tab to add inventory.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card p-4 flex flex-wrap gap-2 items-center">
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[var(--color-brand-gray-200)] rounded-sm px-3 py-1.5 text-sm"
        />
        <Select value={project} onChange={setProject} options={projects} placeholder="All projects" />
        <Select value={unitType} onChange={setUnitType} options={types} placeholder="All types" />
        <Select value={status} onChange={setStatus} options={["available", "reserved", "sold"]} placeholder="All statuses" />
        <span className="text-xs text-[var(--color-brand-gray-500)] ml-2">{filtered.length} shown</span>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost text-xs" onClick={() => downloadFile("inventory.csv", toCsv(filtered), "text/csv")}>
            ⬇ CSV
          </button>
          <button className="btn-ghost text-xs" onClick={() => downloadFile("inventory.json", JSON.stringify(filtered, null, 2), "application/json")}>
            ⬇ JSON
          </button>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-brand-gray-50)] text-left text-xs uppercase tracking-wider">
              <Th k="project" label="Project" />
              <th className="p-2">Ref</th>
              <Th k="unitType" label="Type" />
              <Th k="sizeSqm" label="Size" />
              <Th k="priceOMR" label="Price" />
              <Th k="pricePerSqm" label="/sqm" />
              <Th k="status" label="Status" />
              <th className="p-2">ITC</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[var(--color-brand-gray-200)]">
                <td className="p-2">{u.project}</td>
                <td className="p-2 font-mono text-xs">{u.unitRef}</td>
                <td className="p-2">{u.unitType}</td>
                <td className="p-2">{u.sizeSqm ?? "—"}</td>
                <td className="p-2">{formatOmr(u.priceOMR)}</td>
                <td className="p-2">{formatPerSqm(u.pricePerSqm)}</td>
                <td className="p-2">
                  <span className={`badge ${u.status === "available" ? "badge-extracted" : u.status === "reserved" ? "badge-inferred" : "badge-missing"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="p-2">{u.itcEligible ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Select({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-[var(--color-brand-gray-200)] rounded-sm px-2 py-1.5 text-sm bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
