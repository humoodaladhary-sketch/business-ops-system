"use client";

import { useState } from "react";
import { Card } from "../../components/ui";
import type { CopilotPersona } from "@/domain/crm/settings";

const DIRECTNESS: CopilotPersona["directness"][] = ["gentle", "balanced", "blunt"];
const FORMALITY: CopilotPersona["formality"][] = ["casual", "professional", "formal"];
const VERBOSITY: CopilotPersona["verbosity"][] = ["terse", "balanced", "detailed"];

const inputCls =
  "w-full rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white focus:border-gold/50 focus:outline-none";
const labelCls = "mb-1 block text-xs uppercase tracking-wide text-white/45";

export function CopilotStudio({ initial }: { initial: CopilotPersona }) {
  const [form, setForm] = useState<CopilotPersona>(initial);
  const [principlesText, setPrinciplesText] = useState((initial.signaturePrinciples ?? []).join("\n"));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (p: Partial<CopilotPersona>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const copilot: CopilotPersona = {
      ...form,
      signaturePrinciples: principlesText.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const r = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "copilot", copilot }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok
      ? { ok: true, text: `Copilot voice saved${j.persisted ? "" : " (in-memory until the database is connected)"}.` }
      : { ok: false, text: j.error || "Could not save the copilot voice." });
  }

  return (
    <Card className="space-y-5">
      {msg && <p className={msg.ok ? "text-sm text-emerald-300" : "text-sm text-risk"}>{msg.text}</p>}

      <div>
        <label className={labelCls}>Display name</label>
        <input value={form.displayName} onChange={(e) => patch({ displayName: e.target.value })} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Tone</label>
        <input value={form.tone} onChange={(e) => patch({ tone: e.target.value })} className={inputCls} />
        <p className="mt-1 text-xs text-white/35">One line describing how the copilot should sound.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Directness</label>
          <select
            value={form.directness}
            onChange={(e) => patch({ directness: e.target.value as CopilotPersona["directness"] })}
            className={inputCls}
          >
            {DIRECTNESS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Formality</label>
          <select
            value={form.formality}
            onChange={(e) => patch({ formality: e.target.value as CopilotPersona["formality"] })}
            className={inputCls}
          >
            {FORMALITY.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Verbosity</label>
          <select
            value={form.verbosity}
            onChange={(e) => patch({ verbosity: e.target.value as CopilotPersona["verbosity"] })}
            className={inputCls}
          >
            {VERBOSITY.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Signature principles</label>
        <textarea
          value={principlesText}
          onChange={(e) => setPrinciplesText(e.target.value)}
          rows={5}
          className={`${inputCls} resize-y`}
        />
        <p className="mt-1 text-xs text-white/35">One per line — injected into every department copilot&apos;s system prompt.</p>
      </div>

      <div>
        <label className={labelCls}>Custom instructions</label>
        <textarea
          value={form.customInstructions}
          onChange={(e) => patch({ customInstructions: e.target.value })}
          rows={4}
          className={`${inputCls} resize-y`}
          placeholder="Anything else every copilot should always do…"
        />
      </div>

      <div className="flex items-center justify-end">
        <button
          disabled={busy}
          onClick={save}
          className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm text-gold hover:bg-gold/20 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save voice"}
        </button>
      </div>
    </Card>
  );
}
