"use client";

import { useState } from "react";
import type { Unit } from "@/domain/inventory/unit";
import { formatOmr, formatPct } from "@/domain/inventory/money";

type PreviewKind = "new" | "price-changed" | "changed" | "unchanged";
interface PreviewRow {
  unit: Unit;
  kind: PreviewKind;
  oldPrice: number | null;
  deltaPct: number | null;
}
interface RowError {
  index: number;
  message: string;
}
interface NormalizeResponse {
  units: Unit[];
  errors: RowError[];
  preview: PreviewRow[];
  rawRowCount: number;
  error?: string;
}

const KIND_BADGE: Record<PreviewKind, string> = {
  new: "badge-extracted",
  "price-changed": "badge-inferred",
  changed: "badge-inferred",
  unchanged: "badge-missing",
};

export function IngestTab({ onCommitted }: { onCommitted: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<NormalizeResponse | null>(null);

  async function readFiles(files: FileList | null) {
    if (!files) return;
    const chunks: string[] = [];
    for (const f of Array.from(files)) {
      if (/\.(txt|csv|tsv|md)$/i.test(f.name)) {
        chunks.push(`--- ${f.name} ---\n${await f.text()}`);
      } else {
        chunks.push(`(Could not read ${f.name} as text — paste its contents below.)`);
      }
    }
    setText((prev) => [prev, ...chunks].filter(Boolean).join("\n\n"));
  }

  async function normalize() {
    try {
      setBusy(true);
      setStatus("Normalizing with Claude…");
      setResult(null);
      const resp = await fetch("/api/inventory/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await resp.json()) as NormalizeResponse;
      if (!resp.ok) throw new Error(body.error ?? "Normalize failed");
      setResult(body);
      setStatus(`Parsed ${body.units.length} unit(s) from ${body.rawRowCount} row(s).`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!result) return;
    try {
      setBusy(true);
      setStatus("Saving…");
      const resp = await fetch("/api/inventory/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: result.units }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Commit failed");
      setStatus(`Saved — ${body.inserted} new, ${body.updated} updated, ${body.movements.length} price movement(s).`);
      setResult(null);
      setText("");
      onCommitted();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Paste inventory</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste WhatsApp messages, Excel rows, or PDF table text here…"
          className="w-full border border-[var(--color-brand-gray-200)] rounded-sm px-3 py-2 text-sm font-mono"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <label className="btn-ghost text-xs cursor-pointer">
            + Add text/CSV file
            <input
              type="file"
              multiple
              accept=".txt,.csv,.tsv,.md"
              className="hidden"
              onChange={(e) => readFiles(e.target.files)}
            />
          </label>
          <button className="btn-gold text-xs" disabled={busy || !text.trim()} onClick={normalize}>
            {busy ? "Working…" : "Normalize"}
          </button>
          {status && <span className="text-xs text-[var(--color-brand-gray-500)]">{status}</span>}
        </div>
      </section>

      {result && (
        <section className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Preview</h2>
            <button className="btn-gold text-xs" disabled={busy || result.units.length === 0} onClick={commit}>
              Confirm &amp; commit {result.units.length} unit(s)
            </button>
          </div>

          {result.errors.length > 0 && (
            <div className="text-xs text-amber-700">
              {result.errors.length} row(s) dropped:
              <ul className="list-disc pl-5 mt-1">
                {result.errors.slice(0, 6).map((e) => (
                  <li key={e.index}>row {e.index}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-brand-gray-50)] text-left text-xs uppercase tracking-wider">
                  <th className="p-2">Status</th>
                  <th className="p-2">Project</th>
                  <th className="p-2">Ref</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Size</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Δ</th>
                  <th className="p-2">ITC</th>
                </tr>
              </thead>
              <tbody>
                {result.preview.map((p) => (
                  <tr key={p.unit.id} className="border-t border-[var(--color-brand-gray-200)]">
                    <td className="p-2"><span className={`badge ${KIND_BADGE[p.kind]}`}>{p.kind}</span></td>
                    <td className="p-2">{p.unit.project}</td>
                    <td className="p-2 font-mono text-xs">{p.unit.unitRef}</td>
                    <td className="p-2">{p.unit.unitType}</td>
                    <td className="p-2">{p.unit.sizeSqm ?? "—"}</td>
                    <td className="p-2">{formatOmr(p.unit.priceOMR)}</td>
                    <td className="p-2">
                      {p.deltaPct != null ? (
                        <span className={p.deltaPct >= 0 ? "text-emerald-700" : "text-red-700"}>
                          {formatPct(p.deltaPct, true)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-2">{p.unit.itcEligible ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
