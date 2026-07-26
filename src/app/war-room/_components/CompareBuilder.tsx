"use client";

// Pro Mode comparison report: shortlist 2–3 live units, capture the client's
// requirements once, and produce a print-ready side-by-side with a final
// recommendation. All judgement comes from the pure buildComparison() domain
// function — deterministic, eligibility-hard, and free of invented figures.
import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, Printer, Scale, X } from "lucide-react";
import { buildComparison, type Comparison } from "@/domain/realestate/compare";
import { CATEGORY_LABELS } from "@/domain/realestate/offer";
import type { LiveOfferUnit } from "../../_data/warRoomUnits";
import { formatOMR } from "../../lib/format";
import { Card } from "../../components/ui";
import { UnitPicker } from "./UnitPicker";

const GOALS = ["Capital growth", "Rental income", "Residency", "Lifestyle", "Flip"] as const;

const FIELD =
  "w-full rounded-md border border-hairline bg-ink-100 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";
const LABEL = "mb-1 block text-xs text-white/50";

export function CompareBuilder({ liveUnits }: { liveUnits: LiveOfferUnit[] }) {
  const [clientName, setClientName] = useState("");
  const [nationality, setNationality] = useState("");
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const [budgetOmr, setBudgetOmr] = useState("");
  const [shortlist, setShortlist] = useState<LiveOfferUnit[]>([]);
  const [result, setResult] = useState<{ comparison: Comparison; issuedOn: string } | null>(null);
  const [error, setError] = useState("");

  const addUnit = (u: LiveOfferUnit) => {
    setError("");
    setShortlist((s) => (s.length >= 3 || s.some((x) => x.reference === u.reference) ? s : [...s, u]));
  };
  const removeUnit = (ref: string) => setShortlist((s) => s.filter((x) => x.reference !== ref));

  function onBuild() {
    if (shortlist.length < 2) {
      setError("Add at least two units to compare (up to three).");
      return;
    }
    setError("");
    setResult({
      comparison: buildComparison({
        clientName: clientName.trim(),
        nationality: nationality.trim(),
        goal,
        budgetOmr: Number(budgetOmr) || 0,
        units: shortlist,
      }),
      issuedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-5 print:hidden">
        {/* Client requirements */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gold">Client requirements</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={LABEL}>Client name</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Full name" className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Nationality</label>
              <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. British, Indian, Omani" className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Goal</label>
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className={FIELD}>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Budget (OMR)</label>
              <input type="number" min={0} step={1000} inputMode="numeric" value={budgetOmr} onChange={(e) => setBudgetOmr(e.target.value)} placeholder="e.g. 250000" className={FIELD} />
            </div>
          </div>
        </div>

        {/* Shortlist */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gold">
            Shortlist <span className="text-white/40">({shortlist.length}/3)</span>
          </h3>
          {shortlist.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {shortlist.map((u) => (
                <li key={u.reference} className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 ps-3 pe-1 py-1 text-xs text-gold">
                  {u.reference} · {u.project} · {formatOMR(u.priceOmr, true)}
                  <button type="button" onClick={() => removeUnit(u.reference)} aria-label={`Remove ${u.reference}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-gold/20">
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <UnitPicker
            units={liveUnits}
            nationality={nationality}
            pickedRefs={shortlist.map((u) => u.reference)}
            onPick={addUnit}
            title="Add from live inventory"
            hint="pick 2–3"
          />
        </div>

        {error && <p className="text-sm text-risk">{error}</p>}
        <button
          type="button"
          onClick={onBuild}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 font-medium text-ink transition hover:bg-gold-soft sm:w-auto"
        >
          <Scale className="h-4 w-4" /> Build comparison
        </button>
      </Card>

      {result && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
              <h2 className="text-2xl text-gold">Comparison report</h2>
              <p className="mt-1 text-sm text-white/50">Client-ready — print or save as PDF.</p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-soft"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
          </div>
          <ComparisonSheet
            comparison={result.comparison}
            issuedOn={result.issuedOn}
            client={{ clientName, nationality, goal, budgetOmr: Number(budgetOmr) || 0 }}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Printable comparison sheet (Alwalaa report style)
// ---------------------------------------------------------------------------

function ComparisonSheet({
  comparison,
  issuedOn,
  client,
}: {
  comparison: Comparison;
  issuedOn: string;
  client: { clientName: string; nationality: string; goal: string; budgetOmr: number };
}) {
  const { rows, recommendedRef, recommendationReasons, notes } = comparison;
  const TH = "border-b-2 border-zinc-300 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const TD = "border-b border-zinc-200 px-3 py-2.5 align-top text-sm text-zinc-800";

  const cells = (render: (r: (typeof rows)[number]) => React.ReactNode) =>
    rows.map((r) => (
      <td key={r.unit.reference} className={`${TD} ${r.unit.reference === recommendedRef ? "bg-amber-50" : ""}`}>
        {render(r)}
      </td>
    ));

  return (
    <div className="report-sheet mx-auto w-full max-w-[980px] overflow-hidden rounded-xl bg-white text-zinc-900 shadow-2xl">
      {/* Header band */}
      <div className="flex items-center justify-between gap-4 bg-ink-900 px-6 py-5 sm:px-8">
        <div className="flex items-center gap-4">
          <Image src="/alwalaa-mark.png" alt="Alwalaa" width={48} height={40} className="h-9 w-auto" />
          <div>
            <div className="font-heading text-lg tracking-wide text-white sm:text-xl">ALWALAA REAL ESTATE</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Unit Comparison</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-white/60">
          Issued {issuedOn}
        </div>
      </div>

      <div className="space-y-7 px-6 py-6 sm:px-8">
        {/* Prepared for */}
        <section className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Prepared for</div>
            <div className="mt-0.5 text-xl font-semibold">{client.clientName || "—"}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
              {client.nationality && <span>Nationality: <span className="text-zinc-700">{client.nationality}</span></span>}
              <span>Objective: <span className="text-zinc-700">{client.goal}</span></span>
              {client.budgetOmr > 0 && <span>Budget: <span className="text-zinc-700">{formatOMR(client.budgetOmr)}</span></span>}
            </div>
          </div>
        </section>

        {/* Side-by-side */}
        <section className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Unit</th>
                {rows.map((r) => (
                  <th key={r.unit.reference} className={`${TH} ${r.unit.reference === recommendedRef ? "bg-amber-50" : ""}`}>
                    {r.unit.reference}
                    {r.unit.reference === recommendedRef && (
                      <span className="ms-2 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-900">RECOMMENDED</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><td className={`${TD} font-medium`}>Project</td>{cells((r) => `${r.unit.project}${r.unit.developer ? ` · ${r.unit.developer}` : ""}`)}</tr>
              <tr><td className={`${TD} font-medium`}>Type</td>{cells((r) => r.unit.unitType || "—")}</tr>
              <tr><td className={`${TD} font-medium`}>Community</td>{cells((r) => CATEGORY_LABELS[r.unit.category])}</tr>
              <tr>
                <td className={`${TD} font-medium`}>Eligibility</td>
                {cells((r) =>
                  r.eligible ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3.5 w-3.5" /> Open to this client</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> Not eligible</span>
                  ),
                )}
              </tr>
              <tr><td className={`${TD} font-medium`}>Area</td>{cells((r) => (r.unit.areaSqm > 0 ? `${r.unit.areaSqm} m²` : "—"))}</tr>
              <tr><td className={`${TD} font-medium`}>Price</td>{cells((r) => <span className="font-semibold tabular-nums">{formatOMR(r.unit.priceOmr)}</span>)}</tr>
              <tr><td className={`${TD} font-medium`}>Price / m²</td>{cells((r) => (r.pricePerSqmOmr > 0 ? formatOMR(r.pricePerSqmOmr) : "—"))}</tr>
              <tr>
                <td className={`${TD} font-medium`}>Vs budget</td>
                {cells((r) =>
                  r.withinBudget == null ? "—" : r.withinBudget ? (
                    <span className="text-emerald-700">Within budget ({formatOMR(Math.abs(r.budgetDeltaOmr ?? 0))} under)</span>
                  ) : (
                    <span className="text-red-700">Over by {formatOMR(r.budgetDeltaOmr ?? 0)}</span>
                  ),
                )}
              </tr>
              <tr>
                <td className={`${TD} font-medium`}>First payment</td>
                {cells((r) => (r.eligible ? formatOMR(r.offer.paymentPlan.schedule[0]?.amountOmr ?? 0) : "—"))}
              </tr>
              <tr><td className={`${TD} font-medium`}>Residency</td>{cells((r) => (r.eligible ? r.residency.note : "—"))}</tr>
              <tr>
                <td className={`${TD} font-medium`}>Why / why not</td>
                {cells((r) => (
                  <ul className="list-disc space-y-1 ps-4 text-xs text-zinc-600">
                    {r.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                ))}
              </tr>
            </tbody>
          </table>
        </section>

        {/* Recommendation */}
        <section className={`rounded-lg border p-5 ${recommendedRef ? "border-amber-300 bg-amber-50" : "border-red-300 bg-red-50"}`}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Our recommendation</h2>
          {recommendedRef ? (
            <p className="mt-1 text-lg font-semibold text-zinc-900">
              {recommendedRef} — {rows.find((r) => r.unit.reference === recommendedRef)?.unit.project}
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold text-red-800">No unit on this shortlist fits</p>
          )}
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-zinc-700">
            {recommendationReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </section>

        {/* Notes + footer */}
        <section>
          <ul className="list-disc space-y-1 ps-5 text-xs text-zinc-400">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <p className="mt-4 border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-400">
            Prepared by Alwalaa Real Estate · Muscat, Sultanate of Oman · CR 1386871 · VATIN OM1100425149
          </p>
        </section>
      </div>
    </div>
  );
}
