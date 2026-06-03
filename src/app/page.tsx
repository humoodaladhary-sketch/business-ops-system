import { computePace } from "@/domain";
import { getDemoAgents, DEMO_PERIOD } from "./_data/demo";
import { loadData } from "./_data/source";
import { Card, SectionTitle, StatTile, Badge, ProgressBar } from "./components/ui";
import { TierProgress } from "./components/TierProgress";
import { formatOMR, formatPct } from "./lib/format";

// Demo snapshot is taken ~3/4 through the month for a meaningful pace read.
const DAY_OF_MONTH = 20;
const DAYS_IN_MONTH = 28;

export default async function ThursdayView() {
  const agents = getDemoAgents(await loadData());
  const scoring = agents.filter((a) => a.result.targetAmount > 0);

  const teamVolume = scoring.reduce((s, a) => s + a.result.volumeClosed, 0);
  const teamTarget = scoring.reduce((s, a) => s + a.result.targetAmount, 0);
  const projected = agents.reduce((s, a) => s + a.result.projectedPayout, 0);
  const closings = agents.reduce((s, a) => s + a.result.dealCount, 0);
  const flagged = agents.filter((a) => a.atRisk.atRisk || a.atRisk.watch);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl text-white">Thursday 4 PM — Team Pace</h1>
          <p className="mt-1 text-white/50">
            Period {DEMO_PERIOD} · actual vs pace, who&apos;s ahead, who&apos;s behind, and accountability flags.
          </p>
        </div>
        <Badge variant="gold">Provisional · recomputed on every close</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label="Team volume" value={formatOMR(teamVolume, true)} accent />
        <StatTile label="Attainment" value={formatPct(teamTarget ? teamVolume / teamTarget : 0)} hint={`of ${formatOMR(teamTarget, true)}`} />
        <StatTile label="Projected payouts" value={formatOMR(projected, true)} />
        <StatTile label="Closings" value={closings} />
        <StatTile label="Flagged" value={flagged.length} hint="at-risk / watch" accent={flagged.length > 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle sub="Linear pace through the month — gold bar is actual, marker is where pace expects you.">
            Pace check
          </SectionTitle>
          <Card className="space-y-3">
            {scoring.map((a) => {
              const pace = computePace({
                volumeClosed: a.result.volumeClosed,
                targetAmount: a.result.targetAmount,
                dayOfMonth: DAY_OF_MONTH,
                daysInMonth: DAYS_IN_MONTH,
              });
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm text-white/70">{a.name}</span>
                  <ProgressBar value={a.result.pctOfTarget} markers={[pace.expectedPct]} className="flex-1" />
                  <span className="w-12 text-right text-sm tabular-nums text-white/60">
                    {formatPct(a.result.pctOfTarget)}
                  </span>
                  <span className="w-20 text-right">
                    {pace.aheadOfPace ? <Badge variant="good">ahead</Badge> : <Badge variant="watch">behind</Badge>}
                  </span>
                </div>
              );
            })}
          </Card>
        </div>

        <div>
          <SectionTitle sub="Auto-flagged; At Risk opens a CEO review task.">Accountability</SectionTitle>
          <Card className="space-y-3">
            {flagged.length === 0 && <p className="text-sm text-white/50">No flags this period.</p>}
            {flagged.map((a) => (
              <div key={a.id} className="rounded-lg border border-hairline bg-ink-900/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{a.name}</span>
                  {a.atRisk.atRisk ? <Badge variant="risk">At Risk</Badge> : <Badge variant="watch">Watch</Badge>}
                </div>
                <p className="mt-1 text-xs text-white/50">{a.atRisk.reason}</p>
              </div>
            ))}
            {agents
              .filter((a) => a.inRampWindow || a.exempt)
              .map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-hairline bg-ink-900/20 p-3">
                  <span className="text-sm text-white/70">{a.name}</span>
                  <Badge variant="muted">{a.exempt ? "Trainee · exempt" : "Ramp · exempt"}</Badge>
                </div>
              ))}
          </Card>
        </div>
      </div>

      <div>
        <SectionTitle sub="The live comp plan — each advisor's next-tier nudge.">Live tier progress</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents
            .filter((a) => a.result.targetAmount > 0)
            .map((a) => (
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
