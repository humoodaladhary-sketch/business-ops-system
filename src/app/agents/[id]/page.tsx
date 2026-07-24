import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadData } from "../../_data/source";
import { requireSession, canViewAgent } from "@/infrastructure/auth/session";
import { phoneMeta } from "../../lib/phone";
import { Card, SectionTitle, StatTile, Badge } from "../../components/ui";
import { formatOMR, formatRate } from "../../lib/format";
import { agentStats, bucketize, dealsFor } from "../../_data/analytics";
import { STAGE_LABELS, type CanonicalStage } from "@/domain";

export default async function AgentWorkspace({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const data = await loadData();
  const agent = data.agents.find((a) => a.id === params.id);
  if (!agent) notFound();
  if (!canViewAgent(session, agent.id)) redirect(session.agentId ? `/agents/${session.agentId}` : "/");

  const deals = data.deals.filter((d) => d.agentId === agent.id);
  const leads = data.leads.filter((l) => l.agentId === agent.id);
  const stats = agentStats(data, agent.id);
  const months = bucketize(dealsFor(data, agent.id), "month");
  const volume = stats.volume;
  const pct = agent.target ? volume / agent.target : 0;

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/agents" className="text-sm text-white/40 hover:text-gold">← Agents</Link>
          <h1 className="text-4xl text-white">{agent.name}</h1>
          <p className="mt-1 text-white/50">
            {agent.role.replace(/_/g, " ")} · {agent.segment}
            {agent.status === "FORMER" && <span className="ml-2 text-amber-300">· Former employee (records only)</span>}
          </p>
        </div>
        <Link href={`/portal?agent=${agent.id}`} className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/20">
          Open agent portal →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Leads" value={leads.length} />
        <StatTile label="Deals closed" value={stats.deals} hint={stats.reservations ? `+${stats.reservations} reserved` : `since ${stats.firstClose ?? "—"}`} />
        <StatTile label="Volume" value={formatOMR(volume, true)} accent />
        <StatTile label="Earned" value={formatOMR(stats.earned, true)} hint="paid to agent" />
        <StatTile label="Pending" value={formatOMR(stats.pendingAgent, true)} hint="to be paid" />
        <StatTile label="vs target" value={agent.target ? Math.round(pct * 100) + "%" : "—"} hint={agent.target ? formatOMR(agent.target, true) : "no target"} />
      </div>

      {months.length > 0 && (
        <div>
          <SectionTitle sub="Closings and commission per month.">Monthly breakdown</SectionTitle>
          <Card className="space-y-2">
            {months.map((m) => (
              <div key={m.key} className="flex items-center justify-between border-b border-white/5 pb-2 text-sm last:border-0 last:pb-0">
                <span className="text-white/70">{m.label}</span>
                <span className="flex gap-6 tabular-nums">
                  <span className="text-white/60">{m.deals} {m.deals === 1 ? "deal" : "deals"}</span>
                  <span className="w-28 text-right text-white/80">{formatOMR(m.volume, true)}</span>
                  <span className="w-28 text-right text-gold">{formatOMR(m.commission)}</span>
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Document folders — view / edit / add / upload directly in Drive */}
      <div>
        <SectionTitle sub="Open in Google Drive to view, edit, add rows or upload documents.">Workspace &amp; documents</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <FolderLink href={agent.driveFolder} label="CRM folder" hint="Leads & deals sheet" />
          <FolderLink href={agent.closedDocs} label="Closed-deal docs" hint="SPAs, EOIs, KYC" />
          <FolderLink href={agent.vouchers} label="Payment vouchers" hint="Commission PVs" />
        </div>
      </div>

      <div>
        <SectionTitle>Deals ({deals.length})</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-3 py-3 font-medium">Client</th>
                <th className="px-3 py-3 font-medium">Project</th>
                <th className="px-3 py-3 text-right font-medium">Value</th>
                <th className="px-3 py-3 text-right font-medium">Payout</th>
                <th className="px-3 py-3 font-medium">Agent paid</th>
                <th className="px-3 py-3 font-medium">Closed</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2.5 text-white/80">{d.client}</td>
                  <td className="px-3 py-2.5 text-white/55">{d.developer} · {d.project}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/80">{formatOMR(d.value, true)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gold">{formatOMR(d.payout)}</td>
                  <td className="px-3 py-2.5">{d.agentPaid === "PAID" ? <Badge variant="good">Paid</Badge> : <Badge variant="watch">Unpaid</Badge>}</td>
                  <td className="px-3 py-2.5 text-white/50">{d.stage === "RESERVATION" ? <span className="text-amber-300">SPA pending</span> : d.closeDate}</td>
                </tr>
              ))}
              {deals.length === 0 && <tr><td className="px-3 py-4 text-white/40" colSpan={6}>No deals yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <SectionTitle>Leads ({leads.length})</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-3 py-3 font-medium">Lead</th>
                <th className="px-3 py-3 font-medium">Contact</th>
                <th className="px-3 py-3 font-medium">Country</th>
                <th className="px-3 py-3 font-medium">Stage</th>
                <th className="px-3 py-3 font-medium">Last touch</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const m = phoneMeta(l.phoneRaw);
                return (
                  <tr key={l.id} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2.5 text-white/80">{l.title} {l.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-white/60">{m.code && <span className="text-white/35">+{m.code} </span>}{m.national}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-white/60">{m.flag} {m.country ?? l.country ?? "—"}</td>
                    <td className="px-3 py-2.5 text-white/70">{STAGE_LABELS[l.stage as CanonicalStage] ?? l.stage}</td>
                    <td className="px-3 py-2.5 text-white/45">{l.lastFollowUp ?? l.registeredOn ?? "—"}</td>
                  </tr>
                );
              })}
              {leads.length === 0 && <tr><td className="px-3 py-4 text-white/40" colSpan={5}>No leads yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function FolderLink({ href, label, hint }: { href?: string; label: string; hint: string }) {
  if (!href) {
    return (
      <div className="rounded-lg border border-hairline bg-ink-900/30 p-4 opacity-50">
        <div className="text-white/70">{label}</div>
        <div className="text-xs text-white/40">Not set up yet</div>
      </div>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group rounded-lg border border-hairline bg-ink-900/40 p-4 transition hover:border-gold/40">
      <div className="flex items-center justify-between text-white/80 group-hover:text-gold">
        <span>{label}</span>
        <span>↗</span>
      </div>
      <div className="text-xs text-white/40">{hint}</div>
    </a>
  );
}
