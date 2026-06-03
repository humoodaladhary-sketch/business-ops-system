import { teamTotals } from "../_data/analytics";
import { StatTile, Card } from "../components/ui";
import { formatOMR } from "../lib/format";
import { AnalyticsClient } from "./AnalyticsClient";
import { requireSession, isAdmin } from "@/infrastructure/auth/session";

export const metadata = { title: "Analytics · Alwalaa CRM" };

export default async function AnalyticsPage() {
  const session = await requireSession();
  const admin = isAdmin(session);
  const t = teamTotals();
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-4xl text-white">Agent Analytics</h1>
        <p className="mt-1 text-white/50">
          Deals and commission per agent — since they started, by month / week / day — earned vs. to-be-received, and rankings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label="Deals closed" value={t.deals} accent />
        <StatTile label="Total volume" value={formatOMR(t.volume, true)} />
        <StatTile label="Commission earned" value={formatOMR(t.earned, true)} hint="paid to agents" />
        <StatTile label="Pending to agents" value={formatOMR(t.pendingAgent, true)} />
        <StatTile label="Receivable (Alwalaa)" value={formatOMR(t.alwalaaReceivable, true)} hint="from developers" accent />
      </div>

      <Card className="text-sm text-white/60">
        <span className="font-medium text-gold">Source.</span> Reconciled from the agent sheets and finance records
        (<code className="text-white/80">02_Finance / Invoice and Payment Status</code>). &quot;Earned&quot; = commission already
        paid to the agent; &quot;Pending&quot; = booked but not yet paid; &quot;Receivable&quot; = developer commission Alwalaa is still owed.
      </Card>

      <AnalyticsClient isAdmin={admin} meAgentId={session.agentId} />
    </div>
  );
}
