import { Card } from "../components/ui";
import { PortalClient } from "./PortalClient";
import { requireSession } from "@/infrastructure/auth/session";

export const metadata = { title: "Agent Portal · Alwalaa CRM" };

export default async function PortalPage() {
  const session = await requireSession();
  const isAdmin = session.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl text-white">Agent Portal</h1>
        <p className="mt-1 text-white/50">
          {isAdmin
            ? "Assign leads; advisors accept within 10 minutes or the lead auto-routes to the next advisor."
            : "Accept leads within 10 minutes and update their progress. Unaccepted leads route to the next advisor."}
        </p>
      </div>

      <Card className="text-sm text-white/70">
        <span className="font-medium text-gold">How the 10-minute basket works.</span> An assigned lead lands in the
        advisor&apos;s basket with a live countdown. <b>Accept</b> to claim it, or <b>Pass</b> to release it. If it
        isn&apos;t accepted within 10 minutes it automatically re-routes to the next advisor. (Live in dev; production
        persists to the database and sweeps via a scheduled job.)
      </Card>

      <PortalClient role={session.role} myAgentId={session.agentId} />
    </div>
  );
}
