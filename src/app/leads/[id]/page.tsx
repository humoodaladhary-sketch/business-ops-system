import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { loadData } from "../../_data/source";
import { phoneMeta } from "../../lib/phone";
import { Card, SectionTitle, Badge } from "../../components/ui";
import { STAGE_LABELS, type CanonicalStage } from "@/domain";
import { LeadActivity } from "./LeadActivity";

export const metadata = { title: "Lead · Alwalaa OS" };

export default async function LeadProfile({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const data = await loadData();
  const lead = data.leads.find((l) => l.id === params.id);
  if (!lead) notFound();
  if (session.role !== "ADMIN" && lead.agentId && lead.agentId !== session.agentId) redirect("/leads");

  const meta = phoneMeta(lead.phoneRaw);
  const agentName = lead.agentId ? data.agents.find((a) => a.id === lead.agentId)?.name : null;

  const facts: [string, string | null][] = [
    ["Country", meta.country ?? lead.country],
    ["Nationality", lead.nationality],
    ["Budget", lead.budget],
    ["Interest", lead.projectInterest],
    ["Purpose", lead.purpose],
    ["Source", lead.source === "ALWALAA" ? "Alwalaa-sourced" : "Own / referral"],
    ["Assigned", agentName ?? null],
    ["Last touch", lead.lastFollowUp ?? lead.registeredOn],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-white/40 hover:text-gold">← Leads</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-4xl text-white">{lead.title} {lead.name}</h1>
          <Badge variant="gold">{STAGE_LABELS[lead.stage as CanonicalStage] ?? lead.stage}</Badge>
        </div>
        <p className="mt-1 text-white/55">
          {meta.flag} {meta.code ? `+${meta.code} ` : ""}{meta.national ?? meta.raw}
          {lead.email ? ` · ${lead.email}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <SectionTitle>Details</SectionTitle>
          <dl className="space-y-2 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-white/40">{k}</dt>
                <dd className="text-right text-white/80">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div>
          <SectionTitle sub="Every conversation — WhatsApp, email, call, meeting, note — logged here.">Conversation &amp; activity</SectionTitle>
          <LeadActivity leadId={lead.id} e164={meta.e164} email={lead.email} />
        </div>
      </div>
    </div>
  );
}
