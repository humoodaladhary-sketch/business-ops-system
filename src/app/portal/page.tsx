import { Card } from "../components/ui";
import { PortalClient } from "./PortalClient";

export const metadata = { title: "Agent Portal · Alwalaa CRM" };

export default function PortalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl text-white">Agent Portal</h1>
        <p className="mt-1 text-white/50">
          Assign leads, accept them within 10 minutes, and update progress. Unaccepted leads auto-route to the next advisor.
        </p>
      </div>

      <Card className="text-sm text-white/70">
        <span className="font-medium text-gold">How the 10-minute basket works.</span> When a lead is assigned it lands in
        the advisor&apos;s basket with a live countdown. <b>Accept</b> to claim it, or <b>Pass</b> to release it. If it
        isn&apos;t accepted within 10 minutes it automatically re-routes to the next advisor in the rotation. (Live in dev;
        production persists to the database and sweeps via a scheduled job.)
      </Card>

      <PortalClient />
    </div>
  );
}
