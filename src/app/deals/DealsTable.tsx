"use client";

import { useMemo, useState } from "react";
import type { DealRecord } from "../_data/dataset";
import { AGENT_DIRECTORY, AGENT_NAME_BY_ID } from "../_data/agent-directory";
import { formatOMR, formatRate } from "../lib/format";
import { Badge } from "../components/ui";

const AGENT_NAME = AGENT_NAME_BY_ID;

export function DealsTable({ deals, showAgentFilter = true }: { deals: DealRecord[]; showAgentFilter?: boolean }) {
  const [agent, setAgent] = useState("ALL");
  const [paid, setPaid] = useState("ALL");

  const rows = useMemo(() => {
    return deals
      .filter((d) => {
        if (showAgentFilter && agent !== "ALL" && d.agentId !== agent) return false;
        if (paid === "PAID" && d.agentPaid !== "PAID") return false;
        if (paid === "UNPAID" && d.agentPaid === "PAID") return false;
        return true;
      })
      .sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? ""));
  }, [deals, agent, paid, showAgentFilter]);

  const totalValue = rows.reduce((s, d) => s + d.value, 0);
  const totalGross = rows.reduce((s, d) => s + d.gross, 0);
  const totalPayout = rows.reduce((s, d) => s + d.payout, 0);
  const unpaid = rows.filter((d) => d.agentPaid !== "PAID").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {showAgentFilter && (
          <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
            <option value="ALL">All agents</option>
            {AGENT_DIRECTORY.filter((a) => deals.some((d) => d.agentId === a.id)).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
        <select value={paid} onChange={(e) => setPaid(e.target.value)} className="rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
          <option value="ALL">All payment states</option>
          <option value="PAID">Agent paid</option>
          <option value="UNPAID">Agent unpaid</option>
        </select>
        <span className="ml-auto text-sm text-white/50"><span className="font-semibold text-gold">{rows.length}</span> deals · {unpaid} awaiting agent payout</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline bg-ink-100/60 text-left text-xs uppercase tracking-wide text-white/40">
              <th className="px-3 py-3 font-medium">Agent</th>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Developer / Project</th>
              <th className="px-3 py-3 font-medium">Unit</th>
              <th className="px-3 py-3 text-right font-medium">Value</th>
              <th className="px-3 py-3 text-right font-medium">Dev%</th>
              <th className="px-3 py-3 text-right font-medium">Gross</th>
              <th className="px-3 py-3 text-right font-medium">Split</th>
              <th className="px-3 py-3 text-right font-medium">Payout</th>
              <th className="px-3 py-3 font-medium">Dev paid</th>
              <th className="px-3 py-3 font-medium">Agent paid</th>
              <th className="px-3 py-3 font-medium">PV</th>
              <th className="px-3 py-3 font-medium">Closed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 whitespace-nowrap text-white/80">{AGENT_NAME.get(d.agentId)}</td>
                <td className="px-3 py-2.5 text-white/70">{d.client}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/60">{d.developer}<span className="text-white/35"> · {d.project}</span></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{d.unitType} <span className="text-white/30">{d.unitNumber}</span></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white/80">{formatOMR(d.value, true)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white/40">{d.devRatePct}%</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-white/70">{formatOMR(d.gross)}</td>
                <td className="px-3 py-2.5 text-right"><Badge variant={d.splitPct >= 50 ? "gold" : "default"}>{formatRate(d.splitPct / 100)}</Badge></td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gold">{formatOMR(d.payout)}</td>
                <td className="px-3 py-2.5">{d.devPaid === "RECEIVED" ? <Badge variant="good">Received</Badge> : <Badge variant="risk">Not yet</Badge>}</td>
                <td className="px-3 py-2.5">{d.agentPaid === "PAID" ? <Badge variant="good">Paid</Badge> : <Badge variant="watch">Unpaid</Badge>}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-white/40">{d.pv ?? "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{d.stage === "RESERVATION" ? <span className="text-amber-300">SPA pending</span> : d.closeDate}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-hairline bg-ink-100/40 font-medium">
              <td className="px-3 py-3 text-white/60" colSpan={4}>Totals ({rows.length})</td>
              <td className="px-3 py-3 text-right tabular-nums text-white">{formatOMR(totalValue, true)}</td>
              <td />
              <td className="px-3 py-3 text-right tabular-nums text-white">{formatOMR(totalGross)}</td>
              <td />
              <td className="px-3 py-3 text-right tabular-nums text-gold">{formatOMR(totalPayout)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
