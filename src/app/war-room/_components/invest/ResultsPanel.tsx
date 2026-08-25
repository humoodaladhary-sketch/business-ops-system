"use client";

// Results side of the Invest tab: qualification verdict, KPI grid, strategy
// comparison, offer-price analysis, scenarios, sensitivity, cash-flow chart
// and per-metric explanations. Renders ONLY what the deterministic engine
// returned — null metrics display as "—", never as zero.
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, ChevronDown, Info } from "lucide-react";
import {
  applyAdjustments,
  runInvestmentAnalysis,
  type InvestmentAnalysisInput,
  type InvestmentAnalysisResult,
} from "@/domain/realestate/investment/analyze";
import type { ScenarioAdjustments } from "@/domain/realestate/investment/scenarios";
import { formatOMR } from "../../../lib/format";
import { Badge } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { Metric, NumberField, fmtOrDash } from "./fields";

const pct = (n: number) => `${n.toFixed(2)}%`;
const x2 = (n: number) => `${n.toFixed(2)}×`;
const yrs = (n: number) => `${n.toFixed(1)} yr`;

const STATUS_META: Record<
  InvestmentAnalysisResult["qualification"]["status"],
  { label: string; variant: "gold" | "good" | "watch" | "risk" | "muted" }
> = {
  meets: { label: "Meets objective", variant: "good" },
  partially_meets: { label: "Partially meets", variant: "watch" },
  does_not_meet: { label: "Does not meet", variant: "risk" },
  insufficient_data: { label: "Insufficient data", variant: "muted" },
};

export function ResultsPanel({
  result,
  input,
  onTransferToOffer,
}: {
  result: InvestmentAnalysisResult;
  input: InvestmentAnalysisInput;
  onTransferToOffer: (priceOmr: number) => void;
}) {
  const q = result.qualification;
  const m = result.metrics;
  const meta = STATUS_META[q.status];
  const [showCriteria, setShowCriteria] = useState(true);
  const [showExplains, setShowExplains] = useState(false);

  // Custom scenario (deterministic, computed on demand from the same input)
  const [customRent, setCustomRent] = useState(0);
  const [customOcc, setCustomOcc] = useState(0);
  const [customExp, setCustomExp] = useState(0);
  const [customPrice, setCustomPrice] = useState(0);
  const customOutcome = useMemo(() => {
    if (customRent === 0 && customOcc === 0 && customExp === 0 && customPrice === 0) return null;
    const adj: ScenarioAdjustments = {
      rentDeltaPct: customRent,
      occupancyDeltaPts: customOcc,
      expensesDeltaPct: customExp,
      priceDeltaPct: customPrice,
    };
    const r = runInvestmentAnalysis(applyAdjustments(input, adj));
    return {
      irrPct: r.projection.irrPct,
      cashOnCashPct: r.metrics.cashOnCashPct,
      netYieldPct: r.metrics.netYieldPct,
      monthlyCashFlowOmr: r.metrics.monthlyCashFlowOmr,
      npvOmr: r.projection.npvOmr,
      totalProfitOmr: r.projection.totalProfitOmr,
    };
  }, [input, customRent, customOcc, customExp, customPrice]);

  const chartData = result.projection.periods.map((p) => ({
    name: result.projection.periods.length > 30 ? `M${p.period}` : `Y${p.period}`,
    cashFlow: p.netCashFlowOmr,
    value: p.propertyValueOmr || null,
    loan: p.loanBalanceOmr || null,
    equity: p.equityOmr || null,
  }));

  return (
    <div className="space-y-4">
      {/* Verdict header */}
      <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <span className="text-xs text-white/45">
              Confidence: <span className="text-white/70">{q.confidence}</span>
            </span>
            <span className="text-xs text-white/45">
              Data quality: <span className="text-white/70">{result.dataQuality.score}/100</span>
            </span>
          </div>
          {q.score != null && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-white/45">Deal score</span>
              <span
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-bold tabular-nums",
                  q.score >= 70 ? "border-emerald-400/60 text-emerald-300" : q.score >= 45 ? "border-amber-400/60 text-amber-300" : "border-risk/60 text-risk",
                )}
              >
                {q.score}
              </span>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-white/55">{q.recommendedAction}</p>

        {/* Score categories (explainable) */}
        {q.score != null && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {q.categories.map((c) => (
              <div key={c.key} className="rounded-lg border border-hairline px-2.5 py-1.5">
                <div className="flex items-center justify-between text-[11px] text-white/45">
                  <span>{c.label}</span>
                  <span className="text-white/30">w {c.weightPct}%</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${c.score ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-white/70">
                    {c.score == null ? "—" : Math.round(c.score)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-hairline bg-ink-100/60 p-4 sm:grid-cols-4">
        <Metric label="Analysis price" value={formatOMR(m.analysisPriceOmr, true)} accent />
        <Metric label="Gross yield" value={fmtOrDash(m.grossYieldPct, pct)} />
        <Metric label="Net yield" value={fmtOrDash(m.netYieldPct, pct)} accent />
        <Metric label="Cap rate" value={fmtOrDash(m.capRatePct, pct)} />
        <Metric label="NOI / yr" value={formatOMR(m.noiOmr, true)} />
        <Metric
          label="Monthly cash flow"
          value={formatOMR(m.monthlyCashFlowOmr, true)}
          negative={m.monthlyCashFlowOmr < 0}
        />
        <Metric label="Cash-on-cash" value={fmtOrDash(m.cashOnCashPct, pct)} />
        <Metric label="DSCR" value={fmtOrDash(m.dscr, (n) => n.toFixed(2))} />
        <Metric label="IRR (hold)" value={fmtOrDash(result.projection.irrPct, pct)} accent />
        <Metric label="NPV" value={formatOMR(result.projection.npvOmr, true)} negative={result.projection.npvOmr < 0} />
        <Metric label="Equity multiple" value={fmtOrDash(result.projection.equityMultiple, x2)} />
        <Metric label="Payback" value={fmtOrDash(result.projection.paybackYears, yrs)} />
        <Metric label="Break-even occ." value={fmtOrDash(m.breakEvenOccupancyPct, pct)} />
        <Metric label="LTV" value={fmtOrDash(m.ltvPct, pct)} />
        <Metric label="Cash required" value={formatOMR(result.acquisition.totalCashRequiredOmr, true)} />
        <Metric label="Profit at exit" value={formatOMR(result.projection.totalProfitOmr, true)} negative={result.projection.totalProfitOmr < 0} />
      </div>

      {/* Strategy comparison */}
      {result.strategies.length > 1 && (
        <div className="overflow-x-auto rounded-2xl border border-hairline bg-ink-100/60 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">Rental strategies — side by side</p>
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-white/45">
                <th className="py-1.5 text-left font-medium">Strategy</th>
                <th className="py-1.5 text-right font-medium">EGI / yr</th>
                <th className="py-1.5 text-right font-medium">Opex / yr</th>
                <th className="py-1.5 text-right font-medium">NOI / yr</th>
                <th className="py-1.5 text-right font-medium">NOI / mo</th>
                <th className="py-1.5 text-right font-medium">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {result.strategies.map((s) => (
                <tr
                  key={s.strategy}
                  className={cn(
                    "border-t border-white/5",
                    s.strategy === result.activeStrategy.strategy && "text-gold",
                  )}
                >
                  <td className="py-1.5 capitalize">
                    {s.strategy}
                    {s.strategy === result.activeStrategy.strategy ? " · active" : ""}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatOMR(s.effectiveGrossIncomeOmr, true)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatOMR(s.operatingExpensesOmr, true)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatOMR(s.noiOmr, true)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatOMR(s.monthlyNoiOmr, true)}</td>
                  <td className="py-1.5 text-right tabular-nums">{pct(s.assumedOccupancyPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Offer-price analysis */}
      {result.offer && (
        <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">Offer-price analysis</p>
          {result.offer.maximumJustifiedPriceOmr == null ? (
            <p className="text-xs text-white/55">
              No price in a realistic range meets every stated objective — revisit the targets or the income assumptions.
              {result.offer.perTarget.filter((t) => t.maxPriceOmr == null).length > 0 &&
                ` Unreachable: ${result.offer.perTarget.filter((t) => t.maxPriceOmr == null).map((t) => t.key).join(", ")}.`}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Asking" value={formatOMR(result.offer.askingPriceOmr, true)} />
                <Metric label="Max justified" value={formatOMR(result.offer.maximumJustifiedPriceOmr, true)} accent />
                <Metric
                  label="Suggested opening"
                  value={result.offer.suggestedOpeningOfferOmr != null ? formatOMR(result.offer.suggestedOpeningOfferOmr, true) : "—"}
                />
                <Metric
                  label="Discount needed"
                  value={
                    result.offer.discountRequiredOmr != null
                      ? `${formatOMR(result.offer.discountRequiredOmr, true)} (${result.offer.discountRequiredPct}%)`
                      : "—"
                  }
                  negative={(result.offer.discountRequiredOmr ?? 0) > 0}
                />
              </div>
              {/* Metrics at each price point */}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[460px] text-xs">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-white/45">
                      <th className="py-1 text-left font-medium">Price point</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-right font-medium">Net yield</th>
                      <th className="py-1 text-right font-medium">CoC</th>
                      <th className="py-1 text-right font-medium">IRR</th>
                      <th className="py-1 text-right font-medium">Cash / mo</th>
                      <th className="py-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.offer.metricsAt.map((row) => (
                      <tr key={row.label} className="border-t border-white/5 text-white/75">
                        <td className="py-1.5">{row.label}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatOMR(row.priceOmr, true)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtOrDash(row.metrics.netYieldPct, pct)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtOrDash(row.metrics.cashOnCashPct, pct)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtOrDash(row.metrics.irrPct, pct)}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {fmtOrDash(row.metrics.monthlyCashFlowOmr, (n) => formatOMR(n, true))}
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => onTransferToOffer(row.priceOmr)}
                            className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[11px] text-white/60 transition hover:border-gold/40 hover:text-gold"
                            title="Use this price in the Offer builder"
                          >
                            To Offer <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-white/35">
            <Info className="mt-0.5 h-3 w-3 shrink-0" /> {result.offer.disclaimer}
          </p>
        </div>
      )}

      {/* Cash-flow chart */}
      <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
          Cash flow, value, debt & equity over the hold
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatOMR(v, true).replace(" OMR", "")}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: "#1D1A16", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                formatter={(v: number) => formatOMR(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
              <Bar dataKey="cashFlow" name="Net cash flow" fill="rgba(215,165,44,0.55)" radius={[3, 3, 0, 0]} />
              <Area dataKey="equity" name="Equity" fill="rgba(52,211,153,0.12)" stroke="rgba(52,211,153,0.6)" strokeWidth={1.5} connectNulls />
              <Line dataKey="value" name="Property value" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} dot={false} connectNulls />
              <Line dataKey="loan" name="Loan balance" stroke="rgba(239,68,68,0.7)" strokeWidth={1.5} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scenarios */}
      <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">Scenarios</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-white/45">
                <th className="py-1.5 text-left font-medium">Scenario</th>
                <th className="py-1.5 text-right font-medium">IRR</th>
                <th className="py-1.5 text-right font-medium">Net yield</th>
                <th className="py-1.5 text-right font-medium">CoC</th>
                <th className="py-1.5 text-right font-medium">Cash / mo</th>
                <th className="py-1.5 text-right font-medium">NPV</th>
                <th className="py-1.5 text-right font-medium">Profit at exit</th>
              </tr>
            </thead>
            <tbody>
              {result.scenarios.map((s) => (
                <tr key={s.definition.key} className="border-t border-white/5 text-white/75">
                  <td className="py-1.5">{s.definition.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(s.outcome.irrPct, pct)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(s.outcome.netYieldPct, pct)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(s.outcome.cashOnCashPct, pct)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmtOrDash(s.outcome.monthlyCashFlowOmr, (n) => formatOMR(n, true))}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(s.outcome.npvOmr, (n) => formatOMR(n, true))}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmtOrDash(s.outcome.totalProfitOmr, (n) => formatOMR(n, true))}
                  </td>
                </tr>
              ))}
              {customOutcome && (
                <tr className="border-t border-white/5 text-gold">
                  <td className="py-1.5">Custom</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(customOutcome.irrPct, pct)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(customOutcome.netYieldPct, pct)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(customOutcome.cashOnCashPct, pct)}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmtOrDash(customOutcome.monthlyCashFlowOmr, (n) => formatOMR(n, true))}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtOrDash(customOutcome.npvOmr, (n) => formatOMR(n, true))}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {fmtOrDash(customOutcome.totalProfitOmr, (n) => formatOMR(n, true))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Custom: rent Δ" suffix="%" step={5} value={customRent} onChange={setCustomRent} />
          <NumberField label="Occupancy Δ" suffix="pts" step={5} value={customOcc} onChange={setCustomOcc} />
          <NumberField label="Expenses Δ" suffix="%" step={5} value={customExp} onChange={setCustomExp} />
          <NumberField label="Price Δ" suffix="%" step={2.5} value={customPrice} onChange={setCustomPrice} />
        </div>
      </div>

      {/* Sensitivity (ranked = tornado order) */}
      {result.sensitivity && (
        <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold">
            Sensitivity — ranked by IRR impact
          </p>
          <p className="mb-2 text-[11px] text-white/40">
            Each variable swept alone, everything else at base. Wider spread = the assumption that decides this deal.
          </p>
          <div className="space-y-2">
            {result.sensitivity.ranked
              .filter((r) => r.impact != null)
              .map((row) => {
                const maxImpact = result.sensitivity!.ranked[0].impact ?? 1;
                return (
                  <div key={row.variable.key} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-white/60">{row.variable.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold"
                        style={{ width: `${maxImpact > 0 ? ((row.impact ?? 0) / maxImpact) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-white/70">
                      ±{((row.impact ?? 0) / 2).toFixed(1)} pts
                    </span>
                  </div>
                );
              })}
          </div>
          {/* One-way table for the top mover */}
          {result.sensitivity.ranked[0] && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[380px] text-xs">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-white/45">
                    <th className="py-1 text-left font-medium">
                      {result.sensitivity.ranked[0].variable.label} ({result.sensitivity.ranked[0].variable.unit})
                    </th>
                    {result.sensitivity.ranked[0].cells.map((c) => (
                      <th key={c.step} className="py-1 text-right font-medium tabular-nums">
                        {c.step > 0 ? `+${c.step}` : c.step}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-white/5 text-white/75">
                    <td className="py-1.5">IRR</td>
                    {result.sensitivity.ranked[0].cells.map((c) => (
                      <td key={c.step} className="py-1.5 text-right tabular-nums">
                        {fmtOrDash(c.outcome.irrPct, pct)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Qualification criteria */}
      <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
        <button
          type="button"
          onClick={() => setShowCriteria((s) => !s)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-gold"
          aria-expanded={showCriteria}
        >
          Objective criteria — pass / fail / unknown
          <ChevronDown className={cn("h-4 w-4 transition", showCriteria && "rotate-180")} />
        </button>
        {showCriteria && (
          <div className="mt-3">
            {q.criteria.length === 0 ? (
              <p className="text-xs text-white/45">No objectives set — set targets in step 5 to qualify the deal.</p>
            ) : (
              <ul className="space-y-1.5">
                {q.criteria.map((c) => (
                  <li key={c.key} className="flex items-center gap-3 text-sm">
                    <Badge variant={c.status === "pass" ? "good" : c.status === "fail" ? "risk" : "muted"}>
                      {c.status}
                    </Badge>
                    <span className="min-w-0 flex-1 text-white/75">{c.label}</span>
                    <span className="shrink-0 tabular-nums text-white/50">
                      {c.actual == null ? "—" : c.actual} vs {c.target}
                      {c.distance != null && (
                        <span className={cn("ms-2", c.distance >= 0 ? "text-emerald-300" : "text-risk")}>
                          {c.distance >= 0 ? "+" : ""}
                          {c.distance}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {q.missingData.length > 0 && (
              <p className="mt-2 text-[11px] text-amber-300/80">Missing: {q.missingData.join(", ")}</p>
            )}
          </div>
        )}
      </div>

      {/* Comparables summary */}
      {result.comparableSummary && (
        <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">
            Comparables ({result.comparableSummary.count}) — confidence: {result.comparableSummary.confidence}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Median price/m²" value={fmtOrDash(result.comparableSummary.medianPricePerSqmOmr, (n) => formatOMR(n, true))} />
            <Metric
              label="Subject premium"
              value={fmtOrDash(result.comparableSummary.subjectPremiumPct, (n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`)}
              negative={(result.comparableSummary.subjectPremiumPct ?? 0) > 10}
            />
            <Metric label="Comp-implied value" value={fmtOrDash(result.comparableSummary.adjustedValueOmr, (n) => formatOMR(n, true))} />
            <Metric
              label="Yield range"
              value={
                result.comparableSummary.yieldRange
                  ? `${result.comparableSummary.yieldRange.minPct}–${result.comparableSummary.yieldRange.maxPct}%`
                  : "—"
              }
            />
          </div>
          {result.comparableSummary.notes.map((n) => (
            <p key={n} className="mt-1.5 text-[11px] text-white/40">
              {n}
            </p>
          ))}
        </div>
      )}

      {/* Explain calculations */}
      <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4">
        <button
          type="button"
          onClick={() => setShowExplains((s) => !s)}
          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-gold"
          aria-expanded={showExplains}
        >
          Explain the calculations
          <ChevronDown className={cn("h-4 w-4 transition", showExplains && "rotate-180")} />
        </button>
        {showExplains && (
          <dl className="mt-3 space-y-3">
            {result.explains.map((e) => (
              <div key={e.metric} className="rounded-lg border border-hairline p-3">
                <dt className="text-sm font-semibold text-white">{e.metric}</dt>
                <dd className="mt-1 space-y-1">
                  <p className="font-mono text-[11px] text-gold/80">{e.formula}</p>
                  {e.steps.map((s, i) => (
                    <p key={i} className="text-xs tabular-nums text-white/60">
                      {s}
                    </p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <ul className="space-y-1 rounded-2xl border border-amber-400/25 bg-amber-500/5 p-3">
          {result.warnings.map((w) => (
            <li key={w} className="text-[11px] text-amber-300/85">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
