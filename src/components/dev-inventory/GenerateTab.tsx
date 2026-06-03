"use client";

import { useMemo, useState } from "react";
import type { Unit } from "@/domain/inventory/unit";
import { formatOmr } from "@/domain/inventory/money";
import { CopyButton } from "@/components/ui/CopyButton";

interface ListingCopy {
  headline: string;
  keyFacts: string[];
  description: string;
  cta: string;
}

export function GenerateTab({ units }: { units: Unit[] }) {
  const [project, setProject] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [copy, setCopy] = useState<ListingCopy | null>(null);
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const projects = useMemo(() => Array.from(new Set(units.map((u) => u.project))).sort(), [units]);
  const filtered = useMemo(
    () => (project ? units.filter((u) => u.project === project) : units),
    [units, project],
  );
  const selected = units.find((u) => u.id === selectedId) ?? null;

  async function generate() {
    if (!selected) return;
    try {
      setBusy(true);
      setStatus("Generating with Claude…");
      setCopy(null);
      const resp = await fetch("/api/listings/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit: selected, language }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error ?? "Generation failed");
      setCopy(body.copy);
      setSource(body.source);
      setStatus(body.source === "template" ? "Used template fallback (AI unavailable)." : "Generated.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (units.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
        No units to generate from. Ingest inventory first.
      </div>
    );
  }

  const fullText = copy
    ? `${copy.headline}\n\n${copy.keyFacts.map((f) => `• ${f}`).join("\n")}\n\n${copy.description}\n\n${copy.cta}`
    : "";

  return (
    <div className="space-y-4">
      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Pick a unit</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={project}
            onChange={(e) => { setProject(e.target.value); setSelectedId(""); }}
            className="border border-[var(--color-brand-gray-200)] rounded-sm px-2 py-1.5 text-sm bg-white"
          >
            <option value="">All projects</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border border-[var(--color-brand-gray-200)] rounded-sm px-2 py-1.5 text-sm bg-white min-w-64"
          >
            <option value="">Select a unit…</option>
            {filtered.map((u) => (
              <option key={u.id} value={u.id}>
                {u.project} · {u.unitRef} · {u.unitType} · {formatOmr(u.priceOMR)}
              </option>
            ))}
          </select>
          <div className="flex rounded-sm overflow-hidden border border-[var(--color-brand-gray-200)]">
            {(["en", "ar"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-3 py-1.5 text-xs uppercase ${language === l ? "bg-[var(--color-brand-black)] text-white" : "bg-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="btn-gold text-xs" disabled={busy || !selected} onClick={generate}>
            {busy ? "Working…" : "Generate listing"}
          </button>
          {status && <span className="text-xs text-[var(--color-brand-gray-500)]">{status}</span>}
        </div>
      </section>

      {copy && (
        <section className="card p-6 space-y-4" dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl">{copy.headline}</h2>
            <div className="flex gap-2 shrink-0">
              {source === "template" && <span className="badge badge-missing">template</span>}
              <CopyButton text={fullText} label="Copy all" />
            </div>
          </div>
          <ul className="text-sm space-y-1">
            {copy.keyFacts.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
          <p className="text-sm whitespace-pre-line leading-relaxed">{copy.description}</p>
          <div className="pt-2 border-t border-[var(--color-brand-gray-200)]">
            <span className="badge badge-gold">CTA</span> <span className="text-sm">{copy.cta}</span>
          </div>
        </section>
      )}
    </div>
  );
}
