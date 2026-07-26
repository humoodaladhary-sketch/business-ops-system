"use client";

// War-Room / Pro-mode offer builder for Alwalaa Real Estate. Captures an
// OfferInput, composes it through the pure `buildOffer()` domain function, and
// renders the result as a clean, client-ready OFFER DOCUMENT inside a
// `.report-sheet` block that prints on its own (globals.css @media print whitens
// the sheet and app chrome is hidden via `print:hidden`).
//
// Client-facing by construction: the Offer type carries no commission field, so
// no internal number can leak here — this component never references one.
import { useState } from "react";
import Image from "next/image";
import { Printer, Copy, Check, AlertTriangle } from "lucide-react";
import {
  buildOffer,
  offerToMarkdown,
  type Offer,
  type OfferInput,
  type OfferUnit,
  type UnitCategory,
  type OwnershipEligibility,
} from "@/domain/realestate/offer";
import { formatOMR } from "../../lib/format";
import { Card } from "../../components/ui";
import { UnitPicker } from "./UnitPicker";
import type { LiveOfferUnit } from "../../_data/warRoomUnits";

// ---------------------------------------------------------------------------
// Option lists + display helpers
// ---------------------------------------------------------------------------

const GOALS = ["Capital growth", "Rental income", "Residency", "Lifestyle", "Flip"] as const;

const CATEGORIES: { value: UnitCategory; label: string }[] = [
  { value: "ITC", label: "ITC freehold" },
  { value: "future_cities", label: "Future Cities" },
  { value: "surooh", label: "Surooh" },
];

const ELIGIBILITIES: { value: OwnershipEligibility; label: string }[] = [
  { value: "all_nationalities", label: "All nationalities" },
  { value: "gcc_omani_only", label: "GCC / Omani only" },
];

const CATEGORY_LABEL: Record<UnitCategory, string> = {
  ITC: "ITC freehold",
  future_cities: "Future Cities",
  surooh: "Surooh",
};

/** Parse a numeric text field to a finite number (empty / bad input -> 0). */
function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Mirror of offer.ts area formatting: up to 2 dp + " m²". */
function formatSqm(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)} m²`;
}

/** Mirror of offer.ts payment-schedule due labels. */
function dueLabel(months: number): string {
  if (months <= 0) return "On signing";
  if (months === 1) return "In 1 month";
  return `In ${months} months`;
}

// Shared field / label classes (match the app's form convention; gold/ink/
// hairline are CSS-var driven so they auto-recolour crimson in Pro Mode).
const FIELD =
  "w-full rounded-md border border-hairline bg-ink-100 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";
const LABEL = "mb-1 block text-xs text-white/50";

// Light-sheet table classes (match reports/page.tsx so it prints cleanly).
const TH =
  "border-b-2 border-zinc-300 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
const TD = "border-b border-zinc-200 px-3 py-2 text-sm text-zinc-800";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OfferBuilder({ liveUnits, catalog }: { liveUnits: LiveOfferUnit[]; catalog: OfferUnit[] }) {
  // Client
  const [clientName, setClientName] = useState("");
  const [nationality, setNationality] = useState("");
  const [goal, setGoal] = useState<string>(GOALS[0]);
  const [budgetOmr, setBudgetOmr] = useState("");

  // Unit
  const [reference, setReference] = useState("");
  const [project, setProject] = useState("");
  const [developer, setDeveloper] = useState("");
  const [unitType, setUnitType] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [priceOmr, setPriceOmr] = useState("");
  const [category, setCategory] = useState<UnitCategory>("ITC");
  const [ownershipEligibility, setOwnershipEligibility] = useState<OwnershipEligibility>("all_nationalities");

  // Options
  const [closingToday, setClosingToday] = useState(false);
  const [reservationOffer, setReservationOffer] = useState(false);

  // Prefill + result
  const [catalogProject, setCatalogProject] = useState("");
  const [result, setResult] = useState<{ offer: Offer; input: OfferInput; issuedOn: string } | null>(null);
  const [copied, setCopied] = useState(false);

  /** Copy every unit field from a picked live unit into the form. */
  function applyLiveUnit(u: LiveOfferUnit) {
    setReference(u.reference);
    setProject(u.project);
    setDeveloper(u.developer);
    setUnitType(u.unitType);
    setAreaSqm(u.areaSqm > 0 ? String(u.areaSqm) : "");
    setPriceOmr(String(u.priceOmr));
    setCategory(u.category);
    setOwnershipEligibility(u.ownershipEligibility);
  }

  /** Catalog fallback (no live inventory): prefill the project facts only. */
  function applyCatalogProject(name: string) {
    setCatalogProject(name);
    const p = catalog.find((x) => x.project === name);
    if (!p) return;
    setProject(p.project);
    setDeveloper(p.developer);
    setCategory(p.category);
    setOwnershipEligibility(p.ownershipEligibility);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: OfferInput = {
      clientName: clientName.trim(),
      nationality: nationality.trim(),
      goal,
      budgetOmr: num(budgetOmr),
      unit: {
        reference: reference.trim(),
        project: project.trim(),
        developer: developer.trim(),
        unitType: unitType.trim(),
        areaSqm: num(areaSqm),
        priceOmr: num(priceOmr),
        category,
        ownershipEligibility,
      },
      closingToday,
      reservationOffer,
    };
    const issuedOn = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    setResult({ offer: buildOffer(input), input, issuedOn });
    setCopied(false);
  }

  async function copyAsText() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(offerToMarkdown(result.offer));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------- FORM (screen only) ----------------------------- */}
      <Card className="print:hidden">
        <form onSubmit={onSubmit} className="space-y-5">
          {liveUnits.length > 0 ? (
            <UnitPicker
              units={liveUnits}
              nationality={nationality}
              onPick={applyLiveUnit}
              title="Prefill from live inventory"
              hint="click a unit to fill the form"
            />
          ) : (
            <div>
              <label className={LABEL}>Prefill project facts (catalog)</label>
              <select className={FIELD} value={catalogProject} onChange={(e) => applyCatalogProject(e.target.value)}>
                <option value="">— Choose a project —</option>
                {catalog.map((p) => (
                  <option key={p.project} value={p.project}>
                    {p.project} · {p.category === "ITC" ? "ITC" : "GCC/Omani only"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Client */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gold">Client</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Client name</label>
                <input
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Full name"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Nationality</label>
                <input
                  required
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. British, Indian, Omani"
                  className={FIELD}
                />
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
                <input
                  type="number"
                  min={0}
                  step={1000}
                  inputMode="numeric"
                  value={budgetOmr}
                  onChange={(e) => setBudgetOmr(e.target.value)}
                  placeholder="e.g. 300000"
                  className={FIELD}
                />
              </div>
            </div>
          </div>

          {/* Unit */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gold">Unit</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Reference</label>
                <input
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. AM-1203"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Project</label>
                <input
                  required
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="e.g. Al Mouj"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Developer</label>
                <input
                  value={developer}
                  onChange={(e) => setDeveloper(e.target.value)}
                  placeholder="e.g. Al Mouj Muscat"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Unit type</label>
                <input
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  placeholder="e.g. 2BR Apartment"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Area (m²)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  inputMode="decimal"
                  value={areaSqm}
                  onChange={(e) => setAreaSqm(e.target.value)}
                  placeholder="e.g. 120"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Price (OMR)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  inputMode="numeric"
                  value={priceOmr}
                  onChange={(e) => setPriceOmr(e.target.value)}
                  placeholder="e.g. 240000"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as UnitCategory)}
                  className={FIELD}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Ownership eligibility</label>
                <select
                  value={ownershipEligibility}
                  onChange={(e) => setOwnershipEligibility(e.target.value as OwnershipEligibility)}
                  className={FIELD}
                >
                  {ELIGIBILITIES.map((el) => (
                    <option key={el.value} value={el.value}>
                      {el.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Options */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gold">Closing</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-md border border-hairline bg-ink-100 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={closingToday}
                  onChange={(e) => setClosingToday(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-gold"
                />
                <span className="text-sm text-white/80">
                  Closing today
                  <span className="block text-xs text-white/40">Unlocks the reservation promo</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-hairline bg-ink-100 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={reservationOffer}
                  onChange={(e) => setReservationOffer(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-gold"
                />
                <span className="text-sm text-white/80">
                  Apply 500 OMR reservation
                  <span className="block text-xs text-white/40">Reserve-today offer</span>
                </span>
              </label>
            </div>
            <p className="mt-2 text-xs text-white/35">
              The 500 OMR reserve-today line applies only when both boxes are ticked.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-gold px-4 py-2.5 font-medium text-ink transition hover:bg-gold-soft sm:w-auto"
          >
            Build offer
          </button>
        </form>
      </Card>

      {/* ----------------------------- RESULT ----------------------------- */}
      {result && (
        <>
          {/* Toolbar (never prints) */}
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
              <h2 className="text-2xl text-gold">Offer document</h2>
              <p className="mt-1 text-sm text-white/50">Client-ready — print, save as PDF, or copy as text.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={copyAsText}
                className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy as text"}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-soft"
              >
                <Printer className="h-4 w-4" /> Print / Save PDF
              </button>
            </div>
          </div>

          <OfferSheet offer={result.offer} input={result.input} issuedOn={result.issuedOn} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The printable offer sheet
// ---------------------------------------------------------------------------

function OfferSheet({ offer, input, issuedOn }: { offer: Offer; input: OfferInput; issuedOn: string }) {
  const u = offer.unit;

  return (
    <div className="report-sheet mx-auto w-full max-w-[900px] overflow-hidden rounded-xl bg-white text-zinc-900 shadow-2xl">
      {/* Header band */}
      <div className="flex items-center justify-between gap-4 bg-ink-900 px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-4">
          <Image src="/alwalaa-mark.png" alt="Alwalaa" width={48} height={40} className="h-9 w-auto sm:h-10" />
          <div>
            <div className="font-heading text-lg tracking-wide text-white sm:text-xl">ALWALAA REAL ESTATE</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Investment Offer</div>
          </div>
        </div>
        <div className="text-right text-white">
          <div className="text-sm font-semibold sm:text-lg">{u.project}</div>
          <div className="text-[11px] text-white/50">Ref {u.reference}</div>
        </div>
      </div>

      {/* Ownership restriction: prominent RED warning, pricing withheld. */}
      {!offer.eligibility.ok ? (
        <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-7">
          <div className="rounded-lg border-2 border-red-500 bg-red-50 p-5">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <strong className="text-sm font-bold uppercase tracking-wide">Ownership restriction</strong>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-red-800">{offer.eligibility.reason}</p>
          </div>
          <p className="text-sm leading-relaxed text-zinc-600">
            We have deliberately not prepared pricing for this unit, because the client cannot take freehold
            title here. Ask your Alwalaa advisor to select an <strong>ITC freehold</strong> alternative — open
            to all nationalities and eligible for Golden / Investor Residency.
          </p>
          <p className="border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-400">
            {offer.footerNote}
          </p>
        </div>
      ) : (
        <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-7">
          {/* Prepared-for bar */}
          <section className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Prepared for</div>
              <div className="mt-0.5 text-xl font-semibold text-zinc-900">{input.clientName || "—"}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                {input.nationality && (
                  <span>
                    Nationality: <span className="text-zinc-700">{input.nationality}</span>
                  </span>
                )}
                <span>
                  Objective: <span className="text-zinc-700">{input.goal}</span>
                </span>
                {input.budgetOmr > 0 && (
                  <span>
                    Budget: <span className="text-zinc-700">{formatOMR(input.budgetOmr)}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Issued</div>
              <div className="mt-0.5 text-sm text-zinc-700">{issuedOn}</div>
              <div className="text-[11px] text-zinc-400">Valid {offer.validityDays} days</div>
            </div>
          </section>

          {/* Positive eligibility note */}
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{offer.eligibility.reason}</span>
          </div>

          {/* Unit summary */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">Unit</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Detail label="Reference" value={u.reference} />
              <Detail label="Project" value={u.project} />
              <Detail label="Developer" value={u.developer || "—"} />
              <Detail label="Type" value={u.unitType || "—"} />
              <Detail label="Category" value={CATEGORY_LABEL[u.category]} />
              <Detail label="Area" value={formatSqm(u.areaSqm)} />
            </dl>
          </section>

          {/* Price + price / m² */}
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total price</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">{formatOMR(offer.priceOmr)}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Price / m²</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
                {formatOMR(offer.pricePerSqmOmr)}
              </div>
            </div>
          </section>

          {/* Reservation offer (only when it applies) */}
          {offer.reservationOffer.applies && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">
                {offer.reservationOffer.condition} for {formatOMR(offer.reservationOffer.amountOmr)}
              </div>
              <div className="mt-0.5 text-xs text-amber-800">
                Secures this unit; the {formatOMR(offer.reservationOffer.amountOmr)} reservation is applied to
                the payment plan below.
              </div>
            </div>
          )}

          {/* Payment plan */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">Payment plan</h2>
            <p className="mb-3 text-sm text-zinc-500">
              Total price: <span className="font-semibold text-zinc-900">{formatOMR(offer.priceOmr)}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Payment</th>
                    <th className={TH}>Due</th>
                    <th className={`${TH} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {offer.paymentPlan.schedule.map((step, i) => (
                    <tr key={`${step.label}-${i}`}>
                      <td className={`${TD} font-medium`}>{step.label}</td>
                      <td className={TD}>{dueLabel(step.dueMonthsFromNow)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatOMR(step.amountOmr)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${TD} font-bold`} colSpan={2}>
                      Total
                    </td>
                    <td className={`${TD} text-right font-bold tabular-nums`}>{formatOMR(offer.priceOmr)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Residency */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">Residency</h2>
            <p className="text-sm leading-relaxed text-zinc-700">{offer.residency.note}</p>
          </section>

          {/* Assumptions (muted) */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">Assumptions</h2>
            <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-400">
              {offer.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </section>

          {/* Validity + footer */}
          <p className="border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-400">
            Valid for {offer.validityDays} days from issue. {offer.footerNote}
          </p>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800">{value}</dd>
    </div>
  );
}
