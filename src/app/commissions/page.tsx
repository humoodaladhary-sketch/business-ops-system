import { getDemoCommissions, DEMO_PERIOD } from "../_data/demo";
import { Card, SectionTitle, StatTile, Badge } from "../components/ui";
import { formatOMR, formatRate } from "../lib/format";
import { requireSession, isAdmin } from "@/infrastructure/auth/session";

export default async function CommissionsPage() {
  const session = await requireSession();
  const all = getDemoCommissions();
  const rows = isAdmin(session) ? all : all.filter((r) => r.agentId === session.agentId);
  const totalGross = rows.reduce((s, r) => s + r.alwalaaGross, 0);
  const totalPayout = rows.reduce((s, r) => s + r.agentPayout, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-white">Commissions &amp; Payouts</h1>
        <p className="mt-1 text-white/50">Period {DEMO_PERIOD} · provisional, locks to final at month-close.</p>
      </div>

      <Card className="text-sm text-white/70">
        <span className="font-medium text-gold">How it&apos;s computed.</span>{" "}
        <code className="text-white/80">alwalaaGross = dealValue × developerRate</code> &nbsp;·&nbsp;{" "}
        <code className="text-white/80">agentPayout = alwalaaGross × agentSplitRate</code>. The split is the
        whole-month ladder tier, floored per lead source (own/referral ≥ 50%). Developer rate is tiered by quarterly
        volume (seeded flat).
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatTile label="Alwalaa gross" value={formatOMR(totalGross, true)} />
        <StatTile label="Agent payouts" value={formatOMR(totalPayout, true)} accent />
        <StatTile label="Commission lines" value={rows.length} />
      </div>

      <div>
        <SectionTitle>Commission lines</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-4 py-3 font-medium">Advisor</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Developer / Project</th>
                <th className="px-4 py-3 text-right font-medium">Deal value</th>
                <th className="px-4 py-3 text-right font-medium">Dev %</th>
                <th className="px-4 py-3 text-right font-medium">Alwalaa gross</th>
                <th className="px-4 py-3 text-right font-medium">Split</th>
                <th className="px-4 py-3 text-right font-medium">Agent payout</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dealId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/80">{r.agent}</td>
                  <td className="px-4 py-3 text-white/70">{r.client}</td>
                  <td className="px-4 py-3 text-white/60">
                    {r.developer}
                    <span className="text-white/35"> · {r.project}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-white/80">{formatOMR(r.dealValue, true)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white/50">{formatRate(r.developerRate)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-white/80">{formatOMR(r.alwalaaGross)}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={r.agentSplitRate >= 0.5 ? "gold" : "default"}>{formatRate(r.agentSplitRate)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gold">{formatOMR(r.agentPayout)}</td>
                  <td className="px-4 py-3 text-xs text-white/40">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
