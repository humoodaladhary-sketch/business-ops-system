import Link from "next/link";
import { AGENTS, DEALS, LEADS } from "../_data/dataset";
import { Card, Badge } from "../components/ui";
import { formatOMR } from "../lib/format";

export const metadata = { title: "Agents · Alwalaa CRM" };

const ROLE_LABEL: Record<string, string> = {
  SENIOR: "Senior Advisor",
  HEAD_OF_SALES: "Head of Sales",
  ADVISOR: "Advisor",
  NEW: "New Agent",
  TRAINEE: "Trainee",
  MARKETING: "Marketing",
  FINANCE: "Finance",
  CEO: "CEO",
};

export default function AgentsPage() {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-4xl text-white">Agents</h1>
        <p className="mt-1 text-white/50">Each advisor has a workspace — their leads, deals, commissions and document folders.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a) => {
          const deals = DEALS.filter((d) => d.agentId === a.id);
          const volume = deals.reduce((s, d) => s + d.value, 0);
          const leads = LEADS.filter((l) => l.agentId === a.id).length;
          return (
            <Link key={a.id} href={`/agents/${a.id}`}>
              <Card className={"h-full transition hover:border-gold/40" + (a.status === "FORMER" ? " opacity-60" : "")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl text-white">{a.name}</h3>
                  {a.status === "FORMER" ? (
                    <Badge variant="muted">Former · records</Badge>
                  ) : (
                    <span className="text-xs uppercase tracking-wide text-gold/70">{ROLE_LABEL[a.role] ?? a.role}</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat n={leads} l="Leads" />
                  <Stat n={deals.length} l="Deals" />
                  <Stat n={a.target ? Math.round((volume / a.target) * 100) + "%" : "—"} l="vs target" />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-sm">
                  <span className="text-white/40">Volume</span>
                  <span className="tabular-nums text-white/80">{formatOMR(volume, true)}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] py-2">
      <div className="text-lg font-semibold tabular-nums text-white">{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{l}</div>
    </div>
  );
}
