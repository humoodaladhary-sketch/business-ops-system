import { getPipeline } from "../_data/demo";
import { loadData } from "../_data/source";
import { PipelineBoard } from "../components/PipelineBoard";
import { SectionTitle, StatTile, Card } from "../components/ui";
import { formatPct } from "../lib/format";

// Business data must be read at request time, never frozen into the build.
export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const counts = getPipeline(await loadData());
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const won = counts.CLOSED_WON ?? 0;
  const lost = counts.CLOSED_LOST ?? 0;
  const open = total - won - lost;
  const winRate = won + lost > 0 ? won / (won + lost) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-white">Lead Pipeline</h1>
        <p className="mt-1 text-white/50">
          One canonical pipeline — every agent&apos;s messy stage labels normalized on ingest.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total leads" value={total} />
        <StatTile label="Open" value={open} accent />
        <StatTile label="Closed-Won" value={won} />
        <StatTile label="Win rate" value={formatPct(winRate)} hint="won / (won + lost)" />
      </div>

      <div>
        <SectionTitle sub="New → Qualified → Engaged → Viewing → Negotiation → Reservation → Closed-Won / Closed-Lost">
          Canonical funnel
        </SectionTitle>
        <PipelineBoard counts={counts} />
      </div>

      <Card className="text-sm text-white/60">
        <span className="font-medium text-gold">Normalization note.</span> Source sheets store stage across three
        disagreeing columns (<code className="text-white/80">Deal Stage</code>,{" "}
        <code className="text-white/80">Lead Stage</code>, <code className="text-white/80">Deal Status</code>) with
        values like &quot;Contacted&quot;, &quot;Qualification meeting&quot;, &quot;In Progress&quot;,
        &quot;CLOSED&quot;, &quot;LOST&quot;. The <code className="text-white/80">StageMapping</code> table translates
        each to the canonical pipeline on ingest, so these counts are comparable across advisors.
      </Card>
    </div>
  );
}
