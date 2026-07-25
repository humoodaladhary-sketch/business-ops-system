import { loadData } from "../_data/source";
import { phoneMeta } from "../lib/phone";
import { StatTile } from "../components/ui";
import { LeadsTable } from "./LeadsTable";
import { requireSession, isAdmin } from "@/infrastructure/auth/session";

// Business data must be read at request time, never frozen into the build.
export const dynamic = "force-dynamic";

export const metadata = { title: "Leads · Alwalaa CRM" };

export default async function LeadsPage() {
  const session = await requireSession();
  const admin = isAdmin(session);
  const all = (await loadData()).leads;
  const leads = admin ? all : all.filter((l) => l.agentId === session.agentId);

  const open = leads.filter((l) => l.stage !== "CLOSED_WON" && l.stage !== "CLOSED_LOST").length;
  const won = leads.filter((l) => l.stage === "CLOSED_WON").length;
  const unassigned = leads.filter((l) => !l.agentId).length;
  const countries = new Set(leads.map((l) => phoneMeta(l.phoneRaw).country ?? l.country).filter(Boolean)).size;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-4xl text-white">{admin ? "Leads" : "My Leads"}</h1>
        <p className="mt-1 text-white/50">
          {admin
            ? "Consolidated from every agent sheet — contact, country code, nationality and budget normalized on ingest."
            : "Your assigned leads — contact, country and stage at a glance."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatTile label="Total leads" value={leads.length} accent />
        <StatTile label="Open" value={open} />
        <StatTile label="Won" value={won} />
        <StatTile label="Unassigned" value={unassigned} hint="route via the portal" />
        <StatTile label="Countries" value={countries} hint="auto-detected from phone" />
      </div>

      <LeadsTable leads={leads} showAgentFilter={admin} />
    </div>
  );
}
