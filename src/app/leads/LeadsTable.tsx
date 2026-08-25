"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LeadRecord } from "../_data/dataset";
import { AGENT_DIRECTORY, AGENT_NAME_BY_ID } from "../_data/agent-directory";
import { phoneMeta } from "../lib/phone";
import { STAGE_LABELS, type CanonicalStage } from "@/domain";
import { Badge } from "../components/ui";
import { cn } from "../lib/cn";

const AGENT_NAME = AGENT_NAME_BY_ID;

const STAGE_VARIANT: Record<string, string> = {
  NEW: "muted",
  QUALIFIED: "default",
  ENGAGED: "gold",
  VIEWING: "gold",
  NEGOTIATION: "gold",
  RESERVATION: "good",
  CLOSED_WON: "good",
  CLOSED_LOST: "risk",
};

export function LeadsTable({ leads, showAgentFilter = true }: { leads: LeadRecord[]; showAgentFilter?: boolean }) {
  const [q, setQ] = useState("");
  const [agent, setAgent] = useState("ALL");
  const [stage, setStage] = useState("ALL");
  const [country, setCountry] = useState("ALL");

  const enriched = useMemo(() => leads.map((l) => ({ lead: l, meta: phoneMeta(l.phoneRaw) })), [leads]);

  const countries = useMemo(
    () => Array.from(new Set(enriched.map((e) => e.meta.country ?? e.lead.country).filter(Boolean))).sort() as string[],
    [enriched],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched.filter(({ lead, meta }) => {
      if (showAgentFilter && agent !== "ALL" && lead.agentId !== agent) return false;
      if (stage !== "ALL" && lead.stage !== stage) return false;
      const c = meta.country ?? lead.country;
      if (country !== "ALL" && c !== country) return false;
      if (!needle) return true;
      return [lead.name, lead.email, lead.nationality, c, lead.projectInterest, meta.e164]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [enriched, q, agent, stage, country, showAgentFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, country, project…"
          className="w-72 rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
        />
        {showAgentFilter && (
          <Select value={agent} onChange={setAgent} options={[["ALL", "All agents"] as [string, string], ...AGENT_DIRECTORY.map((a) => [a.id, a.name] as [string, string])]} />
        )}
        <Select value={stage} onChange={setStage} options={[["ALL", "All stages"] as [string, string], ...(Object.keys(STAGE_LABELS) as CanonicalStage[]).map((s) => [s, STAGE_LABELS[s]] as [string, string])]} />
        <Select value={country} onChange={setCountry} options={[["ALL", "All countries"] as [string, string], ...countries.map((c) => [c, c] as [string, string])]} />
        <span className="ml-auto text-sm text-white/50">
          <span className="font-semibold text-gold">{rows.length}</span> of {leads.length} leads
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-ink-100/60 text-left text-xs uppercase tracking-wide text-white/40">
              <th className="px-3 py-3 font-medium">Lead</th>
              <th className="px-3 py-3 font-medium">Contact</th>
              <th className="px-3 py-3 font-medium">Country</th>
              <th className="px-3 py-3 font-medium">Nationality</th>
              <th className="px-3 py-3 font-medium">Budget</th>
              <th className="px-3 py-3 font-medium">Interest</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium">Agent</th>
              <th className="px-3 py-3 font-medium">Last touch</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ lead, meta }) => (
              <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-3 py-2.5">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-white hover:text-gold">{lead.title} {lead.name}</Link>
                  {lead.email && <div className="text-xs text-white/40">{lead.email}</div>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/80">
                  {meta.code && <span className="text-white/40">+{meta.code} </span>}
                  {meta.national ?? meta.raw}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap"><span className="mr-1">{meta.flag}</span><span className="text-white/70">{meta.country ?? lead.country ?? "—"}</span></td>
                <td className="px-3 py-2.5 text-white/60">{lead.nationality ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/60">{lead.budget ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/60">{lead.projectInterest ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={(STAGE_VARIANT[lead.stage] ?? "default") as never}>{STAGE_LABELS[lead.stage as CanonicalStage] ?? lead.stage}</Badge>
                  {lead.rawStage?.toLowerCase() === "closing stage" && <span className="ml-1 text-[10px] text-amber-300/70" title="Normalized from the 'Closing stage' catch-all">⚑</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/70">{lead.agentId ? AGENT_NAME.get(lead.agentId) : <span className="text-amber-300">Unassigned</span>}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{lead.lastFollowUp ?? lead.registeredOn ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white/80 focus:border-gold/50 focus:outline-none")}>
      {options.map(([v, l]) => (
        <option key={v} value={v} className="bg-ink-100">{l}</option>
      ))}
    </select>
  );
}
