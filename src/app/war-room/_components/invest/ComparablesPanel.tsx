"use client";

// Comparables & location signals for the Invest tab.
//
// Comparables: manual add or CSV/JSON paste import (parseComparables) — every
// comp carries source + provenance; nothing is fabricated.
// Location: straight-line distances from VERIFIED landmark coordinates
// (muscat-anchors.ts) — observed geometry. Market-rate layers (area rents,
// prices, occupancy) are shown as "insufficient data — manual input required"
// unless imported comparables supply sourced figures.
import { useMemo, useState } from "react";
import { MapPin, Upload, Trash2 } from "lucide-react";
import type { ComparableProperty } from "@/domain/realestate/investment/comparables";
import { haversineKm } from "@/domain/realestate/investment/comparables";
import { parseComparables } from "@/domain/realestate/investment/comparablesImport";
import { MUSCAT_ANCHORS, ANCHOR_SOURCE } from "../../../_data/muscat-anchors";
import { formatOMR } from "../../../lib/format";
import { FIELD_CLS, NumberField, TextField } from "./fields";

export function ComparablesPanel({
  comparables,
  onChange,
  subject,
}: {
  comparables: ComparableProperty[];
  onChange: (comps: ComparableProperty[]) => void;
  subject: { lat: number | null; lng: number | null };
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  // Manual add
  const [mRef, setMRef] = useState("");
  const [mProject, setMProject] = useState("");
  const [mArea, setMArea] = useState(0);
  const [mPrice, setMPrice] = useState(0);
  const [mRent, setMRent] = useState(0);
  const [mSource, setMSource] = useState("");

  const distances = useMemo(() => {
    if (subject.lat == null || subject.lng == null || (subject.lat === 0 && subject.lng === 0)) return null;
    const from = { lat: subject.lat, lng: subject.lng };
    return MUSCAT_ANCHORS.map((a) => ({ ...a, km: haversineKm(from, { lat: a.lat, lng: a.lng }) })).sort(
      (x, y) => x.km - y.km,
    );
  }, [subject.lat, subject.lng]);

  function runImport() {
    const today = new Date().toISOString().slice(0, 10);
    const { comps, errors } = parseComparables(pasteText, `Manual import ${today}`);
    setImportErrors(errors);
    if (comps.length > 0) {
      onChange([...comparables, ...comps]);
      setPasteText("");
      if (errors.length === 0) setPasteOpen(false);
    }
  }

  function addManual() {
    if (!mRef || !mProject || mArea <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    onChange([
      ...comparables,
      {
        reference: mRef,
        project: mProject,
        areaSqm: mArea,
        askingPriceOmr: mPrice > 0 ? mPrice : null,
        annualRentOmr: mRent > 0 ? mRent : null,
        dataSource: mSource || `Manual entry ${today}`,
        provenance: "estimated",
      },
    ]);
    setMRef("");
    setMProject("");
    setMArea(0);
    setMPrice(0);
    setMRent(0);
  }

  return (
    <div className="space-y-4">
      {/* Location signals */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/45">
          <MapPin className="h-3.5 w-3.5" /> Location signals
        </p>
        {distances ? (
          <>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {distances.slice(0, 8).map((d) => (
                <li key={d.key} className="flex items-center justify-between rounded-lg border border-hairline px-2.5 py-1.5 text-xs">
                  <span className="text-white/65">{d.label}</span>
                  <span className="tabular-nums text-white/85">{d.km.toFixed(1)} km</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-white/35">
              Straight-line distances (observed geometry). {ANCHOR_SOURCE}.
            </p>
          </>
        ) : (
          <p className="rounded-lg border border-hairline bg-ink-100/40 px-3 py-2 text-xs text-white/45">
            Enter latitude / longitude in the Property step to compute verified landmark distances.
          </p>
        )}
        <p className="mt-1.5 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/70">
          Area rent / price / occupancy layers: insufficient data — no live market provider is connected.
          Import sourced comparables below (or connect a provider) instead of estimating; nothing is invented here.
        </p>
      </div>

      {/* Comparables list */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-white/45">Comparables ({comparables.length})</p>
          <button
            type="button"
            onClick={() => setPasteOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] text-white/60 transition hover:border-gold/40 hover:text-white"
          >
            <Upload className="h-3 w-3" /> Import CSV / JSON
          </button>
        </div>

        {pasteOpen && (
          <div className="mb-2 space-y-2">
            <textarea
              aria-label="Paste comparables as CSV or JSON"
              className={`${FIELD_CLS} h-28 font-mono text-xs`}
              placeholder={"reference,project,areaSqm,askingPrice,annualRent,source,provenance\nC-1,Al Mouj,118,142000,11500,Portal 2026-07,observed"}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runImport}
                className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-soft"
              >
                Import
              </button>
              {importErrors.length > 0 && (
                <span className="text-[11px] text-risk">{importErrors.slice(0, 3).join(" · ")}</span>
              )}
            </div>
          </div>
        )}

        {comparables.length > 0 && (
          <ul className="max-h-52 space-y-1 overflow-y-auto">
            {comparables.map((c, i) => (
              <li
                key={`${c.reference}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-hairline bg-ink-100/50 px-2.5 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate text-white/75">
                  {c.reference} · {c.project} · {c.areaSqm} m²
                  {c.askingPriceOmr ? ` · ${formatOMR(c.askingPriceOmr, true)}` : ""}
                  {c.annualRentOmr ? ` · rent ${formatOMR(c.annualRentOmr, true)}/yr` : ""}
                </span>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-white/45">
                  {c.provenance}
                </span>
                <button
                  type="button"
                  aria-label={`Remove comparable ${c.reference}`}
                  onClick={() => onChange(comparables.filter((_, j) => j !== i))}
                  className="shrink-0 text-white/35 transition hover:text-risk"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Manual add */}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <TextField label="Reference" value={mRef} onChange={setMRef} />
          <TextField label="Project" value={mProject} onChange={setMProject} />
          <NumberField label="Area" suffix="m²" value={mArea} onChange={setMArea} />
          <NumberField label="Asking price" suffix="OMR" step={1000} value={mPrice} onChange={setMPrice} />
          <NumberField label="Annual rent" suffix="OMR" step={100} value={mRent} onChange={setMRent} />
          <TextField label="Source" value={mSource} onChange={setMSource} placeholder="e.g. Portal listing" />
        </div>
        <button
          type="button"
          onClick={addManual}
          disabled={!mRef || !mProject || mArea <= 0}
          className="mt-2 rounded-md border border-hairline px-3 py-1.5 text-xs text-white/70 transition hover:border-gold/40 hover:text-white disabled:opacity-40"
        >
          Add comparable
        </button>
      </div>
    </div>
  );
}
