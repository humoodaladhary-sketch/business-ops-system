"use client";

import { useEffect, useState } from "react";
import { Card, Badge, SectionTitle } from "../../components/ui";
import type { RuntimeConfig } from "../../_data/runtimeConfig";

const field =
  "w-full rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";

export function CommissionStudio() {
  const [cfg, setCfg] = useState<RuntimeConfig | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((j) => {
        setCfg(j.config);
        setPersisted(Boolean(j.persisted));
      })
      .catch(() => setMsg({ ok: false, text: "Could not load configuration." }));
  }, []);

  async function save(body: Record<string, unknown>, label: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setCfg(j.config);
      setMsg({ ok: true, text: `${label} saved${j.persisted ? "" : " (in-memory until the database is connected)"}.` });
    } else {
      setMsg({ ok: false, text: j.error || `Could not save ${label.toLowerCase()}.` });
    }
  }

  if (!cfg) return <p className="text-sm text-white/50">Loading configuration…</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Badge variant={persisted ? "good" : "watch"}>{persisted ? "Persisted to database" : "Preview — in-memory"}</Badge>
        {msg && <span className={msg.ok ? "text-sm text-emerald-300" : "text-sm text-risk"}>{msg.text}</span>}
      </div>

      {/* Performance ladder */}
      <div>
        <SectionTitle sub="Whole-month retroactive tier by % of personal target. Splits are fractions of Alwalaa gross.">
          Performance ladder
        </SectionTitle>
        <Card className="space-y-2">
          <div className="grid grid-cols-[1fr_90px_90px_90px] gap-2 text-xs uppercase tracking-wide text-white/40">
            <span>Tier</span><span>Min %</span><span>Max %</span><span>Split %</span>
          </div>
          {cfg.ladder.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_90px_90px] gap-2">
              <input className={field} value={t.tierName}
                onChange={(e) => setCfg({ ...cfg, ladder: cfg.ladder.map((x, j) => (j === i ? { ...x, tierName: e.target.value } : x)) })} />
              <input className={field} type="number" value={Math.round(t.minPctOfTarget * 100)}
                onChange={(e) => setCfg({ ...cfg, ladder: cfg.ladder.map((x, j) => (j === i ? { ...x, minPctOfTarget: Number(e.target.value) / 100 } : x)) })} />
              <input className={field} type="number" value={t.maxPctOfTarget == null ? "" : Math.round(t.maxPctOfTarget * 100)} placeholder="∞"
                onChange={(e) => setCfg({ ...cfg, ladder: cfg.ladder.map((x, j) => (j === i ? { ...x, maxPctOfTarget: e.target.value === "" ? null : Number(e.target.value) / 100 } : x)) })} />
              <input className={field} type="number" value={Math.round(t.agentSplitRate * 100)}
                onChange={(e) => setCfg({ ...cfg, ladder: cfg.ladder.map((x, j) => (j === i ? { ...x, agentSplitRate: Number(e.target.value) / 100 } : x)) })} />
            </div>
          ))}
          <button disabled={busy} onClick={() => save({ section: "ladder", ladder: cfg.ladder }, "Ladder")}
            className="mt-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold-soft disabled:opacity-60">
            Save ladder
          </button>
        </Card>
      </div>

      {/* Developer rates */}
      <div>
        <SectionTitle sub="What each developer pays Alwalaa (% of property value).">Developer commission rates</SectionTitle>
        <Card className="space-y-2">
          {cfg.devRates.map((r, i) => (
            <div key={r.developer} className="grid grid-cols-[1fr_110px] items-center gap-2">
              <span className="text-sm text-white/80">{r.developer}</span>
              <div className="flex items-center gap-1">
                <input className={field} type="number" step="0.1" value={r.ratePct}
                  onChange={(e) => setCfg({ ...cfg, devRates: cfg.devRates.map((x, j) => (j === i ? { ...x, ratePct: Number(e.target.value) } : x)) })} />
                <span className="text-sm text-white/40">%</span>
              </div>
            </div>
          ))}
          <button disabled={busy} onClick={() => save({ section: "devRates", devRates: cfg.devRates }, "Developer rates")}
            className="mt-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold-soft disabled:opacity-60">
            Save developer rates
          </button>
        </Card>
      </div>

      {/* Source floors */}
      <div>
        <SectionTitle sub="Minimum split by lead source — own/referral leads never fall below their floor.">Lead-source floors</SectionTitle>
        <Card className="space-y-2">
          {cfg.floors.map((f, i) => (
            <div key={f.source} className="grid grid-cols-[1fr_110px] items-center gap-2">
              <span className="text-sm text-white/80">{f.source === "AGENT_NETWORK" ? "Own / referral leads" : "Alwalaa-sourced leads"}</span>
              <div className="flex items-center gap-1">
                <input className={field} type="number" value={Math.round(f.floorSplitRate * 100)}
                  onChange={(e) => setCfg({ ...cfg, floors: cfg.floors.map((x, j) => (j === i ? { ...x, floorSplitRate: Number(e.target.value) / 100 } : x)) })} />
                <span className="text-sm text-white/40">%</span>
              </div>
            </div>
          ))}
          <button disabled={busy} onClick={() => save({ section: "floors", floors: cfg.floors }, "Floors")}
            className="mt-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold-soft disabled:opacity-60">
            Save floors
          </button>
        </Card>
      </div>
    </div>
  );
}
