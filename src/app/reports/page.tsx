import Image from "next/image";
import type { ReactNode } from "react";
import { loadData } from "../_data/source";
import { getDemoAgents, getDemoCommissions, getPipeline, dashboardPeriod } from "../_data/demo";
import { loadFinanceSummary } from "../_data/live";
import { formatOMR, formatPct } from "../lib/format";
import { STAGE_LABELS, type CanonicalStage } from "@/domain";
import { PrintButton } from "./PrintButton";

// Business data must be read at request time, never frozen into the build.
export const dynamic = "force-dynamic";

export const metadata = { title: "Report · Alwalaa OS" };

const MONTH = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

export default async function ReportPage() {
  const [data, finance] = await Promise.all([loadData(), loadFinanceSummary()]);
  const period = dashboardPeriod(data);
  const agents = getDemoAgents(data, period).sort((a, b) => b.result.volumeClosed - a.result.volumeClosed);
  const commissions = getDemoCommissions(data, period);
  const pipeline = getPipeline(data);

  const scoring = agents.filter((a) => a.result.targetAmount > 0);
  const teamVolume = scoring.reduce((s, a) => s + a.result.volumeClosed, 0);
  const teamTarget = scoring.reduce((s, a) => s + a.result.targetAmount, 0);
  const projected = agents.reduce((s, a) => s + a.result.projectedPayout, 0);
  const closings = agents.reduce((s, a) => s + a.result.dealCount, 0);
  const totalPayout = commissions.reduce((s, c) => s + c.agentPayout, 0);
  const alwalaaGross = commissions.reduce((s, c) => s + c.alwalaaGross, 0);
  const generated = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  /* ——— Sheet presentation (light-on-dark-app: cream #FBF8F1, near-black #151311).
         Hairlines are #151311 at ~8% (…14) / ~20% (…33); gold #D7A52C is accent only. */
  const TH =
    "border-b border-[#15131133] px-3 pb-2 pt-1 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1513118C]";
  const TD = "border-b border-[#15131114] px-3 py-2.5 text-sm text-[#151311]";
  const MUTED = "text-[#151311B3]";

  const SectionTitle = ({ children }: { children: ReactNode }) => (
    <div className="mb-4 flex items-center gap-4">
      <h3 className="font-heading text-lg tracking-wide text-[#151311]">{children}</h3>
      <div className="h-px flex-1 bg-[#D7A52C66]" aria-hidden />
    </div>
  );

  const KPI = ({
    label,
    value,
    sub,
    highlight = false,
  }: {
    label: string;
    value: string;
    sub?: string;
    highlight?: boolean;
  }) => (
    <div className="px-2 md:px-6 md:first:pl-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#15131180]">{label}</div>
      <div
        className={`mt-2 font-heading text-[26px] leading-none tabular-nums ${highlight ? "text-[#D7A52C]" : "text-[#151311]"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] tabular-nums text-[#15131173]">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* App chrome (dark) — hidden in print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold/80">Alwalaa OS</p>
          <h1 className="mt-1 text-3xl text-white">Reports</h1>
          <p className="mt-1 text-white/50">
            Company performance &amp; commission — {MONTH(period)}. Export to PDF or print.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* The report document (light sheet — prints cleanly) */}
      <div className="report-sheet mx-auto w-full max-w-[1000px] overflow-hidden rounded-xl bg-[#FBF8F1] text-[#151311] shadow-2xl">
        {/* Branded header */}
        <header className="px-8 pb-8 pt-9 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <Image
                src="/alwalaa-logo.png"
                alt="Alwalaa Real Estate"
                width={1272}
                height={1614}
                priority
                className="h-20 w-auto"
              />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#D7A52C]">
                  Performance &amp; Commission
                </div>
                <h2 className="mt-1 font-heading text-[26px] leading-tight text-[#151311] sm:text-3xl">
                  Monthly Report
                </h2>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="font-heading text-xl text-[#151311]">{MONTH(period)}</div>
              <div className="mt-1 text-[11px] text-[#15131173]">Generated {generated}</div>
            </div>
          </div>
          <div className="mt-8 h-px bg-[#D7A52C]" aria-hidden />
        </header>

        <div className="space-y-10 px-8 pb-10 sm:px-10">
          {/* Executive summary */}
          <section>
            <SectionTitle>Executive Summary</SectionTitle>
            <div className="grid grid-cols-2 gap-y-6 border-y border-[#15131114] py-5 md:grid-cols-4 md:divide-x md:divide-[#15131114]">
              <KPI label="Team volume" value={formatOMR(teamVolume, true)} sub={`Target ${formatOMR(teamTarget, true)}`} />
              <KPI label="Attainment" value={formatPct(teamTarget ? teamVolume / teamTarget : 0)} highlight />
              <KPI label="Closings" value={String(closings)} sub="deals won" />
              <KPI label="Agent payouts" value={formatOMR(totalPayout, true)} sub={`Gross ${formatOMR(alwalaaGross, true)}`} />
            </div>
          </section>

          {/* Agent performance */}
          <section>
            <SectionTitle>Agent Performance</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Advisor</th>
                    <th className={TH}>Role</th>
                    <th className={`${TH} text-right`}>Volume (OMR)</th>
                    <th className={`${TH} text-right`}>Target</th>
                    <th className={`${TH} text-right`}>Attainment</th>
                    <th className={`${TH} text-right`}>Deals</th>
                    <th className={TH}>Tier</th>
                    <th className={`${TH} text-right`}>Projected payout</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.id} className="even:bg-[#15131105]">
                      <td className={`${TD} font-medium`}>{a.name}</td>
                      <td className={`${TD} ${MUTED}`}>{a.role}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatOMR(a.result.volumeClosed)}</td>
                      <td className={`${TD} text-right tabular-nums ${MUTED}`}>{formatOMR(a.result.targetAmount)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatPct(a.result.pctOfTarget)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{a.result.dealCount}</td>
                      <td className={`${TD} ${MUTED}`}>
                        {a.result.currentTier} · {formatPct(a.result.currentSplitRate)}
                      </td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>{formatOMR(a.result.projectedPayout)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 pb-1 pt-3 text-sm font-semibold" colSpan={7}>
                      Projected payouts — all advisors
                    </td>
                    <td className="px-3 pb-1 pt-3 text-right text-sm font-semibold tabular-nums">
                      {formatOMR(projected)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Commission statement */}
          <section>
            <SectionTitle>Commission Statement</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Advisor</th>
                    <th className={TH}>Client</th>
                    <th className={TH}>Project</th>
                    <th className={`${TH} text-right`}>Deal value</th>
                    <th className={`${TH} text-right`}>Split</th>
                    <th className={`${TH} text-right`}>Payout (OMR)</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.dealId} className="even:bg-[#15131105]">
                      <td className={`${TD} font-medium`}>{c.agent}</td>
                      <td className={`${TD} ${MUTED}`}>{c.client}</td>
                      <td className={`${TD} ${MUTED}`}>{c.project}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatOMR(c.dealValue)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{formatPct(c.agentSplitRate)}</td>
                      <td className={`${TD} text-right font-semibold tabular-nums`}>{formatOMR(c.agentPayout)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border-t border-[#D7A52C80] px-3 pb-1 pt-3 text-sm font-semibold" colSpan={5}>
                      Total agent payouts
                    </td>
                    <td className="border-t border-[#D7A52C80] px-3 pb-1 pt-3 text-right text-sm font-semibold tabular-nums">
                      {formatOMR(totalPayout)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Finance — live from the Zoho Books sync */}
          {finance && (
            <section>
              <SectionTitle>Collections &amp; Cash</SectionTitle>
              <div className="grid grid-cols-2 gap-y-6 border-y border-[#15131114] py-5 md:grid-cols-4 md:divide-x md:divide-[#15131114]">
                <KPI label="Invoiced (all time)" value={formatOMR(finance.invoicedOMR, true)} sub={`${finance.invoiceCount} commission invoices`} />
                <KPI label="Collected" value={formatOMR(finance.collectedOMR, true)} sub="recorded collections" />
                <KPI label="Outstanding" value={formatOMR(finance.outstandingOMR, true)} sub="invoiced, not yet collected" highlight />
                <KPI label="Overdue" value={formatOMR(finance.overdueOMR, true)} sub={`${finance.overdueCount} invoices past due`} />
              </div>
              <p className="mt-3 text-[11px] text-[#15131173]">
                Live from the Zoho Books sync — the same figures the Finance copilot quotes.
              </p>
            </section>
          )}

          {/* Pipeline */}
          <section>
            <SectionTitle>Pipeline Snapshot</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {Object.entries(pipeline).map(([stage, count]) => (
                <div
                  key={stage}
                  className="flex items-baseline gap-2 rounded-md border border-[#15131121] bg-[#15131105] px-3.5 py-2 text-sm"
                >
                  <span className="font-semibold tabular-nums text-[#151311]">{count}</span>
                  <span className="text-[#15131199]">{STAGE_LABELS[stage as CanonicalStage] ?? stage}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Closing footer */}
        <footer className="px-8 pb-9 sm:px-10">
          <div className="h-px bg-[#D7A52C]" aria-hidden />
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div>
              <div className="font-heading text-sm tracking-wide text-[#151311]">
                Alwalaa Real Estate · Muscat, Sultanate of Oman
              </div>
              <div className="mt-1 text-[11px] tracking-wide text-[#15131199]">CR 1386871 · VATIN OM1100425149</div>
            </div>
            <div className="text-[11px] text-[#15131173] sm:text-right">
              Figures for {MONTH(period)} · Generated by Alwalaa OS on {generated}
            </div>
          </div>
          <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-[#15131159]">
            Confidential — prepared for management
          </p>
        </footer>
      </div>
    </div>
  );
}
