"use client";

import { useEffect, useState } from "react";
import { Card, Badge, SectionTitle } from "../components/ui";
import { formatOMR } from "../lib/format";
import type { InventoryUnit } from "../_data/runtimeConfig";

const field =
  "w-full rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";

const EMPTY = { project: "Wadi Zaha", developer: "Ahly Sabbour", unitType: "Studio", bedrooms: 0, priceOMR: 50000, status: "AVAILABLE" as const, published: false };

export function InventoryClient({ isAdmin }: { isAdmin: boolean }) {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/inventory").then((r) => r.json()).then((j) => setUnits(j.units ?? [])).catch(() => {});
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/inventory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setUnits(j.units ?? []);
      setForm({ ...EMPTY });
      setMsg({ ok: true, text: `Unit added${j.persisted ? "" : " (in-memory until the database is connected)"}.` });
    } else {
      setMsg({ ok: false, text: j.error || "Could not add the unit." });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <SectionTitle sub="Available stock drives lead matching and the portal feed.">Units</SectionTitle>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-3 py-3 font-medium">Project</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 text-right font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Feed</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="text-white/85">{u.project}</div>
                    <div className="text-xs text-white/40">{u.developer}</div>
                  </td>
                  <td className="px-3 py-2.5 text-white/70">{u.unitType}{u.bedrooms != null && u.bedrooms > 0 ? ` · ${u.bedrooms}BR` : ""}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/85">{formatOMR(u.priceOMR, true)}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={u.status === "AVAILABLE" ? "good" : u.status === "RESERVED" ? "watch" : "muted"}>{u.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-3 py-2.5">{u.published ? <Badge variant="gold">published</Badge> : <span className="text-xs text-white/30">private</span>}</td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-white/40">No units yet — add the first one.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {isAdmin && (
        <div>
          <SectionTitle sub="New stock notifies advisors holding matching leads.">Add unit</SectionTitle>
          <Card>
            <form onSubmit={add} className="space-y-3">
              <input className={field} placeholder="Project" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
              <input className={field} placeholder="Developer" value={form.developer} onChange={(e) => setForm({ ...form, developer: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className={field} placeholder="Type (Studio, 1BHK…)" value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })} />
                <input className={field} type="number" placeholder="Bedrooms" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-1">
                <input className={field} type="number" placeholder="Price" value={form.priceOMR} onChange={(e) => setForm({ ...form, priceOMR: Number(e.target.value) })} />
                <span className="text-xs text-white/40">OMR</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                Publish to the portal feed
              </label>
              {msg && <p className={msg.ok ? "text-sm text-emerald-300" : "text-sm text-risk"}>{msg.text}</p>}
              <button disabled={busy} className="w-full rounded-md bg-gold px-4 py-2.5 font-medium text-ink hover:bg-gold-soft disabled:opacity-60">
                {busy ? "Adding…" : "Add unit"}
              </button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
