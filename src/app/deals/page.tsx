import { DEALS, COMP_NEW_EFFECTIVE } from "../_data/dataset";
import { StatTile, Card } from "../components/ui";
import { formatOMR } from "../lib/format";
import { DealsTable } from "./DealsTable";

export const metadata = { title: "Deals · Alwalaa CRM" };

export default function DealsPage() {
  const won = DEALS.filter((d) => d.stage === "CLOSED_WON");
  const totalVolume = DEALS.reduce((s, d) => s + d.value, 0);
  const totalPayout = DEALS.reduce((s, d) => s + d.payout, 0);
  const awaitingDev = DEALS.filter((d) => d.devPaid !== "RECEIVED").length;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-4xl text-white">Team Deals</h1>
        <p className="mt-1 text-white/50">Every closing across the team — developer rate, commission, and payment status.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Total volume" value={formatOMR(totalVolume, true)} accent />
        <StatTile label="Closed-won" value={won.length} hint={`${DEALS.length} total incl. reservations`} />
        <StatTile label="Agent payouts" value={formatOMR(totalPayout, true)} />
        <StatTile label="Awaiting developer" value={awaitingDev} hint="commission not yet received" />
      </div>

      <Card className="text-sm text-white/70">
        <span className="font-medium text-gold">Comp model.</span> Figures below are the <b>legacy</b> recorded splits
        (25% advisor · 35% senior · 50% own/referral, plus the head-of-sales override) in force through June 2026. The
        25/35/40/50 performance ladder activates <b>1 July 2026</b> ({COMP_NEW_EFFECTIVE}) — preview it on Performance.
      </Card>

      <DealsTable />
    </div>
  );
}
