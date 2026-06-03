import { getDemoAgents, DEMO_PERIOD } from "../_data/demo";
import { loadData } from "../_data/source";
import { SectionTitle, Card } from "../components/ui";
import { TierProgress } from "../components/TierProgress";
import { PerformanceChart, type PerfDatum } from "../components/PerformanceChart";

export default async function PerformancePage() {
  const agents = getDemoAgents(await loadData()).filter((a) => a.result.targetAmount > 0);

  const chartData: PerfDatum[] = agents.map((a) => ({
    name: a.name.split(" ")[0],
    volume: a.result.volumeClosed,
    target: a.result.targetAmount,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-white">Performance vs Target</h1>
        <p className="mt-1 text-white/50">Period {DEMO_PERIOD} · closed volume against each advisor&apos;s monthly target.</p>
      </div>

      <Card>
        <SectionTitle sub="Gold = below target · green = at or above target. Ghost bar is the target.">
          Volume vs target
        </SectionTitle>
        <PerformanceChart data={chartData} />
      </Card>

      <div>
        <SectionTitle sub="Each advisor's live tier and next-tier nudge.">Live tier progress</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <TierProgress
              key={a.id}
              name={a.name}
              role={a.role}
              pct={a.result.pctOfTarget}
              tierName={a.result.currentTier}
              splitRate={a.result.currentSplitRate}
              volume={a.result.volumeClosed}
              target={a.result.targetAmount}
              projectedPayout={a.result.projectedPayout}
              nudge={a.nudge}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
