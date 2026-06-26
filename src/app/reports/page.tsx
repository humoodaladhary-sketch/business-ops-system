import Image from "next/image";
import { loadData } from "../_data/source";
import { getDemoAgents, getDemoCommissions, getPipeline, DEMO_PERIOD } from "../_data/demo";
import { formatOMR, formatPct } from "../lib/format";
import { STAGE_LABELS, type CanonicalStage } from "@/domain";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Report · Alwalaa OS" };

const MONTH = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

export default async function ReportPage() {
  const data = await loadData();
  const agents = getDemoAgents(data).sort((a, b) => b.result.volumeClosed - a.result.volumeClosed);
  const commissions = getDemoCommissions(data);
  const pipeline = getPipeline(data);

  const scoring = agents.filter((a) => a.result.targetAmount > 0);
  const teamVolume = scoring.reduce((s, a) => s + a.result.volumeClosed, 0);
  const teamTarget = scoring.reduce((s, a) => s + a.result.targetAmount, 0);
  const projected = agents.reduce((s, a) => s + a.result.projectedPayout, 0);
  const closings = agents.reduce((s, a) => s + a.result.dealCount, 0);
  const totalPayout = commissions.reduce((s, c) => s + c.agentPayout, 0);
  const alwalaaGross = commissions.reduce((s, c) => s + c.alwalaaGross, 0);
  const generated = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const TH = "border-b-2 border-zinc-300 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
  const TD = "border-b border-zinc-200 px-3 py-2 text-sm text-zinc-800";
  const KPI = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-900">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl text-white">Reports</h1>
          <p className="mt-1 text-white/50">Company performance &amp; commission — {MONTH(DEMO_PERIOD)}. Export to PDF or print.</p>
        </div>
        <PrintButton />
      </div>

      {/* The report document (light sheet — prints cleanly) */}
      <div className="report-sheet mx-auto w-full max-w-[1000px] overflow-hidden rounded-xl bg-white text-zinc-900 shadow-2xl">
        {/* Header band */}
        <div className="flex items-center justify-between gap-4 bg-ink-900 px-8 py-6">
          <div className="flex items-center gap-4">
            <Image src="/alwalaa-mark.png" alt="Alwalaa" width={48} height={40} className="h-10 w-auto" />
            <div>
              <div className="font-heading text-xl tracking-wide text-white">ALWALAA REAL ESTATE</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-gold/80">Performance &amp; Commission Report</div>
            </div>
          </div>
          <div className="text-right text-white">
            <div className="text-lg font-semibold">{MONTH(DEMO_PERIOD)}</div>
            <div className="text-[11px] text-white/50">Generated {generated}</div>
          </div>
        </div>

        <div className="space-y-8 px-8 py-7">
          {/* Executive summary */}
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">Executive summary</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KPI label="Team volume" value={formatOMR(teamVolume, true)} sub={`Target ${formatOMR(teamTarget, true)}`} />
              <KPI label="Attainment" value={formatPct(teamTarget ? teamVolume / teamTarget : 0)} />
              <KPI label="Closings" value={String(closings)} sub="deals won" />
              <KPI label="Agent payouts" value={formatOMR(totalPayout, true)} sub={`Gross ${formatOMR(alwalaaGross, true)}`} />
            </div>
          </section>

          {/* Agent performance */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">Agent performance</h2>
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
                  <tr key={a.id}>
                    <td className={`${TD} font-medium`}>{a.name}</td>
                    <td className={TD}>{a.role}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatOMR(a.result.volumeClosed)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatOMR(a.result.targetAmount)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatPct(a.result.pctOfTarget)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{a.result.dealCount}</td>
                    <td className={TD}>{a.result.currentTier} · {formatPct(a.result.currentSplitRate)}</td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>{formatOMR(a.result.projectedPayout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Commission statement */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">Commission statement</h2>
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
                  <tr key={c.dealId}>
                    <td className={`${TD} font-medium`}>{c.agent}</td>
                    <td className={TD}>{c.client}</td>
                    <td className={TD}>{c.project}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatOMR(c.dealValue)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatPct(c.agentSplitRate)}</td>
                    <td className={`${TD} text-right font-semibold tabular-nums`}>{formatOMR(c.agentPayout)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={`${TD} font-bold`} colSpan={5}>Total agent payouts</td>
                  <td className={`${TD} text-right font-bold tabular-nums`}>{formatOMR(totalPayout)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Pipeline */}
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">Pipeline snapshot</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(pipeline).map(([stage, count]) => (
                <div key={stage} className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-zinc-900">{count}</span>
                  <span className="ml-2 text-zinc-500">{STAGE_LABELS[stage as CanonicalStage] ?? stage}</span>
                </div>
              ))}
            </div>
          </section>

          <p className="border-t border-zinc-200 pt-4 text-[11px] text-zinc-400">
            Alwalaa Real Estate · Muscat, Oman — generated by Alwalaa OS on {generated}. Figures for {MONTH(DEMO_PERIOD)}.
            Once LeadRat, Zoho Books and Respond.io are connected, this report reflects live data automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
