"use client";

// Investment report document — a cream `.report-sheet` that prints/PDFs on
// its own (globals.css whitens it in @media print; the rest of the tab is
// print:hidden). Two variants rendered from the SAME deterministic result:
//   internal — everything, including the offer/negotiation analysis
//   client   — negotiation strategy and internal warnings removed BEFORE
//              rendering (clientSafeResult), commission never existed here
// The optional AI narrative is fetched from /api/invest/report, which feeds
// the model the stored structured result only.
import { useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Printer, Sparkles } from "lucide-react";
import type { InvestmentAnalysisResult } from "@/domain/realestate/investment/analyze";
import { clientSafeResult } from "@/lib/investReport";
import { formatOMR } from "../../../lib/format";
import { cn } from "../../../lib/cn";
import { ToggleChip } from "./fields";

const pct = (n: number) => `${n.toFixed(2)}%`;
const dash = (v: number | null | undefined, f: (n: number) => string) => (v == null ? "—" : f(v));

const TH =
  "border-b-2 border-zinc-300 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
const TD = "border-b border-zinc-200 px-3 py-2 text-sm text-zinc-800";
const H2 = "mt-6 mb-2 font-heading text-lg text-zinc-900";

export function ReportSheet({
  result,
  savedId,
  title,
}: {
  result: InvestmentAnalysisResult;
  savedId: string | null;
  title: string;
}) {
  const [audience, setAudience] = useState<"internal" | "client">("internal");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeState, setNarrativeState] = useState<"idle" | "loading" | "setup" | "error">("idle");
  const [narrativeDetail, setNarrativeDetail] = useState("");

  const isClient = audience === "client";
  const view = isClient ? clientSafeResult(result) : result;
  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  async function generateNarrative() {
    if (!savedId) return;
    setNarrativeState("loading");
    setNarrative(null);
    try {
      const res = await fetch("/api/invest/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: savedId, audience, language }),
      });
      const j = await res.json();
      if (j.ok) {
        setNarrative(j.narrative);
        setNarrativeState("idle");
      } else if (j.setup) {
        setNarrativeState("setup");
        setNarrativeDetail(j.reason ?? "");
      } else {
        setNarrativeState("error");
        setNarrativeDetail(j.detail ?? j.error ?? "failed");
      }
    } catch {
      setNarrativeState("error");
      setNarrativeDetail("Network error");
    }
  }

  return (
    <div className="space-y-3">
      {/* Controls — never printed */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-xs font-semibold uppercase tracking-wide text-gold">Report</span>
          <ToggleChip label="Internal" active={audience === "internal"} onClick={() => { setAudience("internal"); setNarrative(null); }} />
          <ToggleChip label="Client-safe" active={audience === "client"} onClick={() => { setAudience("client"); setNarrative(null); }} />
          <ToggleChip label="EN" active={language === "en"} onClick={() => setLanguage("en")} />
          <ToggleChip label="AR" active={language === "ar"} onClick={() => setLanguage("ar")} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generateNarrative}
            disabled={!savedId || narrativeState === "loading"}
            title={savedId ? "Generate the AI narrative from the saved result" : "Save the analysis first"}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs text-white/70 transition hover:border-gold/40 hover:text-white disabled:opacity-40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {narrativeState === "loading" ? "Writing…" : "AI narrative"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-soft"
          >
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
        </div>
      </div>
      {narrativeState === "setup" && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 print:hidden">
          {narrativeDetail || "AI narrative needs configuration."}
        </p>
      )}
      {narrativeState === "error" && (
        <p className="rounded-lg border border-risk/30 bg-risk/10 px-3 py-2 text-xs text-risk print:hidden">
          Narrative failed: {narrativeDetail}
        </p>
      )}
      {!savedId && (
        <p className="text-[11px] text-white/35 print:hidden">
          Save the analysis to enable the AI narrative (the model narrates the stored server-computed result).
        </p>
      )}

      {/* The sheet */}
      <div
        dir={language === "ar" && narrative ? "rtl" : "ltr"}
        className="report-sheet mx-auto max-w-4xl rounded-xl bg-cream p-8 text-zinc-900 shadow-2xl sm:p-10"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-zinc-300 pb-4">
          <div>
            <p className="font-heading text-2xl text-zinc-900">Alwalaa Real Estate</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Investment Analysis — {isClient ? "Client Report" : "Internal Report"}
            </p>
          </div>
          <Image src="/alwalaa-mark.png" alt="Alwalaa" width={48} height={40} className="h-9 w-auto sm:h-10" />
        </div>

        <h1 className="mt-4 font-heading text-xl text-zinc-900">{title}</h1>
        <p className="text-xs text-zinc-500">
          Generated {generatedOn} · formulas v{result.formulaVersion} · currency OMR
          {isClient ? " · client-safe version" : " · internal — do not share"}
        </p>

        {/* 1-2 Verdict */}
        <h2 className={H2}>Verdict</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              view.qualification.status === "meets"
                ? "bg-emerald-100 text-emerald-800"
                : view.qualification.status === "partially_meets"
                  ? "bg-amber-100 text-amber-800"
                  : view.qualification.status === "does_not_meet"
                    ? "bg-red-100 text-red-800"
                    : "bg-zinc-200 text-zinc-600",
            )}
          >
            {view.qualification.status.replace(/_/g, " ")}
          </span>
          {view.qualification.score != null && (
            <span className="text-sm text-zinc-700">
              Deal score <strong>{view.qualification.score}/100</strong> · confidence {view.qualification.confidence}
            </span>
          )}
          <span className="text-sm text-zinc-500">Data quality {view.dataQuality.score}/100</span>
        </div>
        {!isClient && <p className="mt-1.5 text-sm text-zinc-600">{view.qualification.recommendedAction}</p>}

        {/* AI narrative */}
        {narrative && (
          <>
            <h2 className={H2}>Narrative</h2>
            <div className="space-y-2 text-sm leading-relaxed text-zinc-800 [&_h1]:font-heading [&_h1]:text-lg [&_h2]:mt-3 [&_h2]:font-heading [&_h2]:text-base [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:ms-4 [&_li]:list-disc [&_table]:w-full [&_td]:border [&_td]:border-zinc-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-zinc-300 [&_th]:bg-zinc-100 [&_th]:px-2 [&_th]:py-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{narrative}</ReactMarkdown>
            </div>
          </>
        )}

        {/* 4 Property overview */}
        <h2 className={H2}>Property</h2>
        <table className="w-full">
          <tbody>
            {(
              [
                ["Reference", view.property.reference],
                ["Project", view.property.project],
                ["Developer", view.property.developer],
                ["Type", view.property.unitType],
                ["Bedrooms", view.property.bedrooms != null ? String(view.property.bedrooms) : undefined],
                ["Area", view.property.areaSqm > 0 ? `${view.property.areaSqm} m²` : undefined],
                ["Completion", view.property.completionStatus === "off_plan" ? `Off-plan (handover in ${view.property.handoverMonths ?? 0} months)` : "Ready"],
                ["Community", view.property.category],
                ["Asking price", formatOMR(view.property.askingPriceOmr)],
                ["Analysis price", formatOMR(view.analysisPriceOmr)],
                ["Price / m²", view.acquisition.pricePerSqmOmr != null ? formatOMR(view.acquisition.pricePerSqmOmr) : undefined],
                ["Data source", view.property.dataSource],
              ] as [string, string | undefined][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <tr key={k}>
                  <td className={cn(TD, "w-44 text-zinc-500")}>{k}</td>
                  <td className={TD}>{v}</td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* 5 Acquisition */}
        <h2 className={H2}>Acquisition costs</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Item</th>
              <th className={cn(TH, "text-right")}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={TD}>Purchase price</td>
              <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(view.analysisPriceOmr)}</td>
            </tr>
            {view.acquisition.lines.map((l) => (
              <tr key={l.key}>
                <td className={TD}>{l.label}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(l.amountOmr)}</td>
              </tr>
            ))}
            <tr>
              <td className={cn(TD, "font-semibold")}>Total acquisition cost</td>
              <td className={cn(TD, "text-right font-semibold tabular-nums")}>
                {formatOMR(view.acquisition.totalAcquisitionCostOmr)}
              </td>
            </tr>
            <tr>
              <td className={cn(TD, "font-semibold")}>Cash required</td>
              <td className={cn(TD, "text-right font-semibold tabular-nums")}>
                {formatOMR(view.acquisition.totalCashRequiredOmr)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 6 Financing */}
        <h2 className={H2}>Financing</h2>
        {view.financing.mode === "cash" ? (
          <p className="text-sm text-zinc-700">All-cash purchase — no debt service.</p>
        ) : view.financing.mode === "mortgage" && view.financing.schedule ? (
          <table className="w-full">
            <tbody>
              <tr><td className={cn(TD, "w-44 text-zinc-500")}>Loan</td><td className={TD}>{formatOMR(view.financing.loanOmr)}</td></tr>
              <tr><td className={cn(TD, "text-zinc-500")}>Payment</td><td className={TD}>{formatOMR(view.financing.schedule.paymentOmr)} / period</td></tr>
              <tr><td className={cn(TD, "text-zinc-500")}>Annual debt service</td><td className={TD}>{formatOMR(view.metrics.annualDebtServiceOmr)}</td></tr>
              <tr><td className={cn(TD, "text-zinc-500")}>LTV</td><td className={TD}>{dash(view.metrics.ltvPct, pct)}</td></tr>
              <tr><td className={cn(TD, "text-zinc-500")}>DSCR</td><td className={TD}>{dash(view.metrics.dscr, (n) => n.toFixed(2))}</td></tr>
              <tr><td className={cn(TD, "text-zinc-500")}>Total interest over term</td><td className={TD}>{formatOMR(view.financing.schedule.totalInterestOmr)}</td></tr>
            </tbody>
          </table>
        ) : (
          <>
            <p className="mb-1 text-sm text-zinc-700">Developer payment plan — instalments below are part of the price.</p>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Payment</th>
                  <th className={cn(TH, "text-right")}>Due</th>
                  <th className={cn(TH, "text-right")}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {view.financing.scheduledOutflows.slice(0, 26).map((o, i) => (
                  <tr key={i}>
                    <td className={TD}>{o.label}</td>
                    <td className={cn(TD, "text-right")}>{o.monthsFromStart === 0 ? "On signing" : `+${o.monthsFromStart} mo`}</td>
                    <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(o.amountOmr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 7 Strategies */}
        <h2 className={H2}>Rental strategies (illustrative assumptions)</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Strategy</th>
              <th className={cn(TH, "text-right")}>Effective income</th>
              <th className={cn(TH, "text-right")}>Expenses</th>
              <th className={cn(TH, "text-right")}>NOI / yr</th>
              <th className={cn(TH, "text-right")}>Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {view.strategies.map((s) => (
              <tr key={s.strategy} className={s.strategy === view.activeStrategy.strategy ? "bg-amber-50" : undefined}>
                <td className={cn(TD, "capitalize")}>
                  {s.strategy}
                  {s.strategy === view.activeStrategy.strategy ? " (used)" : ""}
                </td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(s.effectiveGrossIncomeOmr)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(s.operatingExpensesOmr)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(s.noiOmr)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{pct(s.assumedOccupancyPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 8 KPIs */}
        <h2 className={H2}>Key figures</h2>
        <table className="w-full">
          <tbody>
            {(
              [
                ["Gross yield", dash(view.metrics.grossYieldPct, pct)],
                ["Net yield", dash(view.metrics.netYieldPct, pct)],
                ["Cap rate", dash(view.metrics.capRatePct, pct)],
                ["Monthly cash flow", formatOMR(view.metrics.monthlyCashFlowOmr)],
                ["Cash-on-cash", dash(view.metrics.cashOnCashPct, pct)],
                ["IRR over hold", dash(view.projection.irrPct, pct)],
                ["NPV", formatOMR(view.projection.npvOmr)],
                ["Equity multiple", dash(view.projection.equityMultiple, (n) => `${n.toFixed(2)}×`)],
                ["Payback", dash(view.projection.paybackYears, (n) => `${n.toFixed(1)} years`)],
                ["Break-even occupancy", dash(view.metrics.breakEvenOccupancyPct, pct)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <tr key={k}>
                <td className={cn(TD, "w-44 text-zinc-500")}>{k}</td>
                <td className={cn(TD, "tabular-nums")}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 9 Cash flow */}
        <h2 className={H2}>Multi-year cash flow</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Year</th>
              <th className={cn(TH, "text-right")}>Income</th>
              <th className={cn(TH, "text-right")}>Expenses</th>
              <th className={cn(TH, "text-right")}>Debt</th>
              <th className={cn(TH, "text-right")}>Net cash</th>
              <th className={cn(TH, "text-right")}>Value</th>
              <th className={cn(TH, "text-right")}>Equity</th>
            </tr>
          </thead>
          <tbody>
            {view.projection.periods
              .filter((p) => view.projection.periods.length <= 30 || p.period % 12 === 0)
              .map((p) => (
                <tr key={p.period}>
                  <td className={TD}>{p.year}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(p.rentalIncomeOmr, true)}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(p.operatingExpensesOmr, true)}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(p.debtServiceOmr, true)}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>{formatOMR(p.netCashFlowOmr, true)}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>{p.propertyValueOmr ? formatOMR(p.propertyValueOmr, true) : "—"}</td>
                  <td className={cn(TD, "text-right tabular-nums")}>{p.equityOmr ? formatOMR(p.equityOmr, true) : "—"}</td>
                </tr>
              ))}
            <tr>
              <td className={cn(TD, "font-semibold")}>Exit (yr {view.projection.exit.exitYear})</td>
              <td className={cn(TD, "text-right text-zinc-500")} colSpan={3}>
                {view.projection.exit.method === "exit_cap" ? "Exit-cap valuation" : "Appreciated value"} − selling costs − loan balance
                {view.projection.exit.remainingPlanObligationOmr > 0
                  ? ` − ${formatOMR(view.projection.exit.remainingPlanObligationOmr, true)} remaining plan instalments`
                  : ""}
              </td>
              <td className={cn(TD, "text-right font-semibold tabular-nums")} colSpan={3}>
                Net proceeds {formatOMR(view.projection.exit.netSaleProceedsOmr)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 10 Scenarios */}
        <h2 className={H2}>Scenarios</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>Scenario</th>
              <th className={cn(TH, "text-right")}>IRR</th>
              <th className={cn(TH, "text-right")}>Net yield</th>
              <th className={cn(TH, "text-right")}>Monthly cash</th>
              <th className={cn(TH, "text-right")}>Profit at exit</th>
            </tr>
          </thead>
          <tbody>
            {view.scenarios.map((s) => (
              <tr key={s.definition.key}>
                <td className={TD}>{s.definition.label}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{dash(s.outcome.irrPct, pct)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{dash(s.outcome.netYieldPct, pct)}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{dash(s.outcome.monthlyCashFlowOmr, (n) => formatOMR(n, true))}</td>
                <td className={cn(TD, "text-right tabular-nums")}>{dash(s.outcome.totalProfitOmr, (n) => formatOMR(n, true))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 11 Sensitivity */}
        {view.sensitivity && (
          <>
            <h2 className={H2}>What moves this deal most</h2>
            <ol className="ms-5 list-decimal space-y-0.5 text-sm text-zinc-700">
              {view.sensitivity.ranked
                .filter((r) => r.impact != null)
                .slice(0, 5)
                .map((r) => (
                  <li key={r.variable.key}>
                    {r.variable.label} — IRR swings {r.impact} points across the tested range
                  </li>
                ))}
            </ol>
          </>
        )}

        {/* 13 Comparables */}
        {view.comparableSummary && (
          <>
            <h2 className={H2}>Comparable properties</h2>
            <p className="text-sm text-zinc-700">
              {view.comparableSummary.count} comparables · median {dash(view.comparableSummary.medianPricePerSqmOmr, (n) => formatOMR(n))}/m² ·
              subject {dash(view.comparableSummary.subjectPremiumPct, (n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`)} vs median ·
              confidence {view.comparableSummary.confidence}
            </p>
            {view.comparableSummary.notes.map((n) => (
              <p key={n} className="mt-0.5 text-xs text-zinc-500">{n}</p>
            ))}
          </>
        )}

        {/* 14 Objectives table */}
        {view.qualification.criteria.length > 0 && (
          <>
            <h2 className={H2}>Objectives — pass / fail</h2>
            <table className="w-full">
              <thead>
                <tr>
                  <th className={TH}>Criterion</th>
                  <th className={cn(TH, "text-right")}>Target</th>
                  <th className={cn(TH, "text-right")}>Actual</th>
                  <th className={cn(TH, "text-right")}>Status</th>
                </tr>
              </thead>
              <tbody>
                {view.qualification.criteria.map((c) => (
                  <tr key={c.key}>
                    <td className={TD}>{c.label}</td>
                    <td className={cn(TD, "text-right tabular-nums")}>{c.target}</td>
                    <td className={cn(TD, "text-right tabular-nums")}>{c.actual ?? "—"}</td>
                    <td className={cn(TD, "text-right")}>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          c.status === "pass" ? "bg-emerald-100 text-emerald-800" : c.status === "fail" ? "bg-red-100 text-red-800" : "bg-zinc-200 text-zinc-600",
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 15 Offer (internal only — clientSafeResult removed it for clients) */}
        {!isClient && result.offer && result.offer.maximumJustifiedPriceOmr != null && (
          <>
            <h2 className={H2}>Offer analysis (internal)</h2>
            <table className="w-full">
              <tbody>
                <tr><td className={cn(TD, "w-52 text-zinc-500")}>Asking price</td><td className={cn(TD, "tabular-nums")}>{formatOMR(result.offer.askingPriceOmr)}</td></tr>
                <tr><td className={cn(TD, "text-zinc-500")}>Maximum justified price</td><td className={cn(TD, "tabular-nums")}>{formatOMR(result.offer.maximumJustifiedPriceOmr)}</td></tr>
                {result.offer.suggestedOpeningOfferOmr != null && (
                  <tr><td className={cn(TD, "text-zinc-500")}>Suggested opening offer</td><td className={cn(TD, "tabular-nums")}>{formatOMR(result.offer.suggestedOpeningOfferOmr)}</td></tr>
                )}
                {result.offer.suggestedRange && (
                  <tr><td className={cn(TD, "text-zinc-500")}>Negotiation range</td><td className={cn(TD, "tabular-nums")}>{formatOMR(result.offer.suggestedRange.minimumOmr)} – {formatOMR(result.offer.suggestedRange.maximumOmr)}</td></tr>
                )}
                <tr><td className={cn(TD, "text-zinc-500")}>Walk-away price</td><td className={cn(TD, "tabular-nums")}>{result.offer.walkAwayPriceOmr != null ? formatOMR(result.offer.walkAwayPriceOmr) : "—"}</td></tr>
                <tr>
                  <td className={cn(TD, "text-zinc-500")}>Discount vs asking</td>
                  <td className={cn(TD, "tabular-nums")}>
                    {result.offer.discountRequiredOmr != null ? `${formatOMR(result.offer.discountRequiredOmr)} (${result.offer.discountRequiredPct}%)` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-xs text-zinc-500">{result.offer.disclaimer}</p>
          </>
        )}

        {/* 16 Risk register */}
        <h2 className={H2}>Risk register</h2>
        <ul className="ms-5 list-disc space-y-0.5 text-sm text-zinc-700">
          {view.qualification.negatives.length > 0 ? (
            view.qualification.negatives.map((n) => <li key={n}>{n}</li>)
          ) : (
            <li>No criterion-level negatives at the current assumptions — see sensitivities above.</li>
          )}
          {view.metrics.breakEvenOccupancyPct != null && view.metrics.breakEvenOccupancyPct > 75 && (
            <li>Break-even occupancy of {pct(view.metrics.breakEvenOccupancyPct)} leaves limited vacancy headroom.</li>
          )}
          {view.property.completionStatus === "off_plan" && (
            <li>Off-plan: completion timing is a developer commitment, not a certainty — delays defer all income.</li>
          )}
        </ul>

        {/* 17 Missing data */}
        {(view.dataQuality.missingFields.length > 0 || view.qualification.missingData.length > 0) && (
          <>
            <h2 className={H2}>Missing data — verify before committing</h2>
            <ul className="ms-5 list-disc space-y-0.5 text-sm text-zinc-700">
              {[...new Set([...view.dataQuality.missingFields, ...view.qualification.missingData])].map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        )}

        {/* 18-19 Assumptions & sources */}
        <h2 className={H2}>Assumptions & data sources</h2>
        <ul className="ms-5 list-disc space-y-0.5 text-xs text-zinc-600">
          <li>Verified fields: {view.dataQuality.verifiedFields.length > 0 ? view.dataQuality.verifiedFields.join(", ") : "none"}</li>
          <li>Estimated/assumed fields: {[...view.dataQuality.estimatedFields, ...view.dataQuality.assumedFields].join(", ") || "none"}</li>
          <li>Rental income, occupancy, operating costs, escalation, appreciation and exit values are user-entered assumptions.</li>
          <li>Government fees and closing costs are configurable assumptions to confirm per transaction — they change.</li>
          <li>Property facts source: {view.property.dataSource ?? "manual entry"}.</li>
        </ul>

        {/* 20 Disclaimer */}
        <div className="mt-6 border-t-2 border-zinc-300 pt-3">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            All amounts in Omani Rial (OMR). This report is generated from the figures and assumptions entered
            by the preparer via a deterministic calculation engine (v{result.formulaVersion}); projections,
            yields and returns are illustrative assumptions — not forecasts, promises or guarantees. Any
            suggested price is an analytical estimate, not a market valuation or appraisal. This document is
            not financial, legal, tax or immigration advice. Residency eligibility is decided solely by the
            Royal Oman Police. {isClient ? "Prepared for the client by " : "Internal working document of "}
            Alwalaa Real Estate, Muscat, Sultanate of Oman. Generated {generatedOn}.
          </p>
        </div>
      </div>
    </div>
  );
}
