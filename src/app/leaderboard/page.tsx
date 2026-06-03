import { computeAgentOfMonth, computeOverachievers, type AgentMonth } from "@/domain";
import { getDemoAgents, DEMO_PERIOD } from "../_data/demo";
import { Leaderboard, type LeaderRow } from "../components/Leaderboard";
import { SectionTitle, Card, Badge } from "../components/ui";
import { formatOMR } from "../lib/format";

export default function LeaderboardPage() {
  const agents = getDemoAgents();

  const rows: LeaderRow[] = agents
    .map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      volume: a.result.volumeClosed,
      target: a.result.targetAmount,
      pct: a.result.pctOfTarget,
      tier: a.result.currentTier,
      splitRate: a.result.currentSplitRate,
      projectedPayout: a.result.projectedPayout,
      dealCount: a.result.dealCount,
      atRisk: a.atRisk.atRisk,
      watch: a.atRisk.watch,
      exempt: a.exempt,
      inRampWindow: a.inRampWindow,
    }))
    .sort((a, b) => b.pct - a.pct);

  const agentMonths: AgentMonth[] = agents
    .filter((a) => a.result.targetAmount > 0)
    .map((a) => ({ agentId: a.id, pctOfTarget: a.result.pctOfTarget }));
  const aotm = computeAgentOfMonth(agentMonths);
  const overachievers = computeOverachievers(agentMonths, 1000);
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-white">Leaderboard</h1>
        <p className="mt-1 text-white/50">Period {DEMO_PERIOD} · ranked by % of personal monthly target.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">Agent of the Month</div>
            <div className="mt-1 text-xl text-gold">{aotm ? nameById.get(aotm.agentId) : "—"}</div>
            {aotm && <div className="text-xs text-white/40">{aotm.note}</div>}
          </div>
          <span className="text-3xl">🏆</span>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-white/40">Overachievers (≥200%)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {overachievers.length === 0 && <span className="text-sm text-white/40">None this period</span>}
            {overachievers.map((o) => (
              <Badge key={o.agentId} variant="gold">
                {nameById.get(o.agentId)} · +{formatOMR(o.amount, true)}
              </Badge>
            ))}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-white/40">Streak bonus (3× Top)</div>
          <div className="mt-2 text-sm text-white/40">Tracked at month-close across the tier history.</div>
        </Card>
      </div>

      <div>
        <SectionTitle>Standings</SectionTitle>
        <Leaderboard rows={rows} />
      </div>
    </div>
  );
}
