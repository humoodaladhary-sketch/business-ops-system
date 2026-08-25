"use client";

import { useCallback, useEffect, useState } from "react";
import { AGENT_NAME_BY_ID } from "../_data/agent-directory";
import { ROUTING_POOL, type Assignment } from "../_data/assignment";
import { Card, Badge } from "../components/ui";

const NAME = AGENT_NAME_BY_ID;
const POOL = ROUTING_POOL.map((id) => ({ id, name: NAME.get(id) ?? id }));
const STAGES = ["ENGAGED", "VIEWING", "NEGOTIATION", "RESERVATION", "CLOSED_WON", "CLOSED_LOST"];

export function PortalClient({ role, myAgentId }: { role: "ADMIN" | "AGENT"; myAgentId: string | null }) {
  const isAdmin = role === "ADMIN";
  const [items, setItems] = useState<Assignment[]>([]);
  const [me, setMe] = useState<string>(!isAdmin && myAgentId ? myAgentId : POOL[0].id);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/portal/state", { cache: "no-store" });
    const j = await r.json();
    setItems(j.assignments ?? []);
  }, []);

  const act = useCallback(async (action: string, leadId: string, extra: Record<string, string> = {}) => {
    const r = await fetch("/api/portal/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, leadId, ...extra }),
    });
    const j = await r.json();
    if (j.assignments) setItems(j.assignments);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const m = new URLSearchParams(window.location.search).get("agent");
      if (m && POOL.some((p) => p.id === m)) setMe(m);
    }
    refresh();
    const poll = setInterval(refresh, 3000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh, isAdmin]);

  const unclaimed = items.filter((a) => a.status === "UNCLAIMED");
  const myBasket = items.filter((a) => a.status === "ASSIGNED" && a.agentId === me);
  const myWorking = items.filter((a) => a.status === "CLAIMED" && a.agentId === me);

  return (
    <div className={isAdmin ? "grid gap-6 lg:grid-cols-2" : ""}>
      {isAdmin && (
        <div>
          <h2 className="mb-3 text-2xl text-gold">Assignment board</h2>
          <Card className="space-y-3">
            {unclaimed.length === 0 && <p className="text-sm text-white/50">No unassigned leads in the queue.</p>}
            {unclaimed.map((a) => (
              <div key={a.leadId} className="rounded-lg border border-hairline bg-ink-900/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{a.name}</div>
                    <div className="text-xs text-white/45">{a.country} · {a.budget} · {a.projectInterest}</div>
                  </div>
                  <Badge variant="muted">Unassigned</Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <AssignControl onAssign={(agentId) => act("assign", a.leadId, { agentId })} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl text-gold">{isAdmin ? "Agent portal" : "My basket"}</h2>
          {isAdmin ? (
            <select value={me} onChange={(e) => setMe(e.target.value)} className="rounded-md border border-hairline bg-ink-100 px-2.5 py-1.5 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
              {POOL.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <span className="text-sm text-white/50">{NAME.get(me) ?? me}</span>
          )}
        </div>

        <Card className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-white/40">Incoming basket · 10-minute window</div>
          {myBasket.length === 0 && <p className="text-sm text-white/50">Nothing waiting. Assigned leads appear here.</p>}
          {myBasket.map((a) => (
            <div key={a.leadId} className="rounded-lg border border-gold/30 bg-gold/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{a.name}</div>
                  <div className="text-xs text-white/45">{a.country} · {a.budget} · {a.projectInterest}</div>
                </div>
                <Countdown expiresAt={a.claimExpiresAt} />
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => act("claim", a.leadId, { agentId: me })} className="rounded-md bg-gold px-3 py-1.5 text-sm font-medium text-ink hover:bg-gold-soft">Accept</button>
                <button onClick={() => act("pass", a.leadId)} className="rounded-md border border-hairline px-3 py-1.5 text-sm text-white/70 hover:bg-white/5">Pass</button>
              </div>
            </div>
          ))}

          <div className="border-t border-hairline pt-3 text-xs uppercase tracking-wide text-white/40">Working ({myWorking.length})</div>
          {myWorking.map((a) => (
            <div key={a.leadId} className="rounded-lg border border-hairline bg-ink-900/40 p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white">{a.name}</div>
                <Badge variant="good">Claimed</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-white/40">Stage</span>
                <select defaultValue={a.stage} onChange={(e) => act("stage", a.leadId, { stage: e.target.value })} className="rounded-md border border-hairline bg-ink-100 px-2 py-1 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
                  {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, "-")}</option>)}
                </select>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function AssignControl({ onAssign }: { onAssign: (agentId: string) => void }) {
  const [sel, setSel] = useState(POOL[0].id);
  return (
    <>
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded-md border border-hairline bg-ink-100 px-2.5 py-1.5 text-sm text-white/80 focus:border-gold/50 focus:outline-none">
        {POOL.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button onClick={() => onAssign(sel)} className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold hover:bg-gold/20">Assign →</button>
    </>
  );
}

function Countdown({ expiresAt }: { expiresAt: number | null }) {
  if (!expiresAt) return <Badge variant="muted">—</Badge>;
  const remaining = Math.max(0, expiresAt - Date.now());
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const danger = remaining < 2 * 60 * 1000;
  return <span className={"tabular-nums text-sm font-semibold " + (danger ? "text-risk" : "text-gold")}>{mm}:{String(ss).padStart(2, "0")}</span>;
}
