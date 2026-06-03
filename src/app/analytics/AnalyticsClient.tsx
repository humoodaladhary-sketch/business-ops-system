"use client";

import { useMemo, useState } from "react";
import { ranking, bucketize, dealsFor, type Metric, type Grain } from "../_data/analytics";
import type { DataBundle } from "../_data/source";
import { Card, SectionTitle } from "../components/ui";
import { formatOMR } from "../lib/format";

const METRICS: [Metric, string][] = [
  ["volume", "Volume"],
  ["deals", "Deals closed"],
  ["earned", "Commission earned"],
  ["pendingAgent", "Commission pending"],
  ["avgDeal", "Avg deal size"],
];
const GRAINS: [Grain, string][] = [
  ["month", "Per month"],
  ["week", "Per week"],
  ["day", "Per day"],
];
const MEDALS = ["🥇", "🥈", "🥉"];

export function AnalyticsClient({ data, isAdmin = true, meAgentId = null }: { data: DataBundle; isAdmin?: boolean; meAgentId?: string | null }) {
  const [metric, setMetric] = useState<Metric>("volume");
  const [agent, setAgent] = useState<string>(isAdmin ? "ALL" : meAgentId ?? "ALL");
  const [grain, setGrain] = useState<Grain>("month");

  const sales = useMemo(() => data.agents.filter((a) => ["SENIOR", "ADVISOR", "NEW"].includes(a.role) && a.status !== "FORMER"), [data]);
  const meName = data.agents.find((a) => a.id === meAgentId)?.name ?? "Me";
  const ranked = useMemo(() => ranking(data, metric), [data, metric]);
  const buckets = useMemo(() => bucketize(dealsFor(data, agent as "ALL"), grain), [data, agent, grain]);
  const maxVol = Math.max(1, ...buckets.map((b) => b.volume));

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle sub="Active sales agents ranked since they started.">Agent ranking</SectionTitle>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
            {METRICS.map(([v, l]) => <option key={v} value={v}>By {l.toLowerCase()}</option>)}
          </select>
        </div>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-3 py-3 font-medium">#</th>
                <th className="px-3 py-3 font-medium">Agent</th>
                <th className="px-3 py-3 text-right font-medium">Deals</th>
                <th className="px-3 py-3 text-right font-medium">Volume</th>
                <th className="px-3 py-3 text-right font-medium">Avg deal</th>
                <th className="px-3 py-3 text-right font-medium">Earned</th>
                <th className="px-3 py-3 text-right font-medium">Pending (agent)</th>
                <th className="px-3 py-3 text-right font-medium">Alwalaa receivable</th>
                <th className="px-3 py-3 font-medium">Since</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((s, i) => (
                <tr key={s.agentId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 text-white/50">{MEDALS[i] ?? i + 1}</td>
                  <td className="px-3 py-2.5"><span className="font-medium text-white">{s.name}</span> <span className="text-xs text-white/40">{s.role.replace(/_/g, " ").toLowerCase()}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/80">{s.deals}{s.reservations > 0 && <span className="text-white/35"> +{s.reservations}</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/80">{formatOMR(s.volume, true)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/50">{formatOMR(s.avgDeal, true)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-300">{formatOMR(s.earned)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-300">{formatOMR(s.pendingAgent)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/60">{formatOMR(s.alwalaaReceivable)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-white/45">{s.firstClose ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle sub="Closings & commission over time.">Time breakdown</SectionTitle>
          <div className="flex gap-2">
            {isAdmin ? (
              <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
                <option value="ALL">Whole team</option>
                {sales.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <span className="rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white/60">{meName}</span>
            )}
            <select value={grain} onChange={(e) => setGrain(e.target.value as Grain)} className="rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
              {GRAINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <Card className="space-y-2">
          {buckets.length === 0 && <p className="text-sm text-white/50">No closings in this view.</p>}
          {buckets.map((b) => (
            <div key={b.key} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-white/60">{b.label}</span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
                <div className="h-full rounded-md bg-gradient-to-r from-gold-deep/70 to-gold/70" style={{ width: `${Math.max((b.volume / maxVol) * 100, 3)}%` }} />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/80">{formatOMR(b.volume, true)}</span>
              </div>
              <span className="w-16 text-right tabular-nums text-white/60">{b.deals} {b.deals === 1 ? "deal" : "deals"}</span>
              <span className="w-24 text-right tabular-nums text-gold">{formatOMR(b.commission, true)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
