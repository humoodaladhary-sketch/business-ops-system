"use client";

import { useState } from "react";
import { Card } from "../../components/ui";

export function TargetsEditor({ agents }: { agents: { id: string; name: string; role: string; target: number }[] }) {
  const [rows, setRows] = useState(agents);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save(agentId: string, amount: number) {
    setBusyId(agentId);
    setMsg(null);
    const r = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "target", agentId, amount }),
    });
    const j = await r.json().catch(() => ({}));
    setBusyId(null);
    setMsg(r.ok
      ? { ok: true, text: `Target saved${j.persisted ? "" : " (in-memory until the database is connected)"}.` }
      : { ok: false, text: j.error || "Could not save target." });
  }

  return (
    <Card className="space-y-3">
      {msg && <p className={msg.ok ? "text-sm text-emerald-300" : "text-sm text-risk"}>{msg.text}</p>}
      {rows.map((a, i) => (
        <div key={a.id} className="grid grid-cols-[1fr_160px_90px] items-center gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
          <div>
            <div className="text-sm text-white/85">{a.name}</div>
            <div className="text-[10px] uppercase tracking-wide text-white/35">{a.role.toLowerCase()}</div>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={a.target}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, target: Number(e.target.value) } : x)))}
              className="w-full rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-right text-sm tabular-nums text-white focus:border-gold/50 focus:outline-none"
            />
            <span className="text-xs text-white/40">OMR</span>
          </div>
          <button
            disabled={busyId === a.id}
            onClick={() => save(a.id, a.target)}
            className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold hover:bg-gold/20 disabled:opacity-60"
          >
            {busyId === a.id ? "Saving…" : "Save"}
          </button>
        </div>
      ))}
    </Card>
  );
}
