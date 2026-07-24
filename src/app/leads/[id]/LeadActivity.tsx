"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Mail, Phone, Video, Users, StickyNote } from "lucide-react";
import { Card } from "../../components/ui";
import type { Touch } from "../../_data/activity";

const REL = (ms: number) => {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  WHATSAPP: MessageCircle, EMAIL: Mail, CALL: Phone, MEET: Video, TEAMS: Users, NOTE: StickyNote, SYSTEM: StickyNote,
};

export function LeadActivity({ leadId, e164, email }: { leadId: string; e164: string | null; email: string | null }) {
  const [touches, setTouches] = useState<Touch[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/leads/${leadId}/activity`, { cache: "no-store" });
    const j = await r.json();
    setTouches(j.touches ?? []);
  }, [leadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const log = useCallback(
    async (channel: string, body?: string) => {
      setBusy(true);
      const r = await fetch(`/api/leads/${leadId}/activity`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, direction: "OUTBOUND", body }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.touches) setTouches(j.touches);
      setBusy(false);
    },
    [leadId],
  );

  const digits = (e164 ?? "").replace(/[^\d]/g, "");

  function launch(channel: string) {
    let url: string | null = null;
    if (channel === "WHATSAPP" && digits) url = `https://wa.me/${digits}`;
    else if (channel === "EMAIL" && email) url = `mailto:${email}`;
    else if (channel === "CALL" && e164) url = `tel:${e164}`;
    else if (channel === "MEET") url = "https://meet.new";
    else if (channel === "TEAMS") url = "https://teams.microsoft.com/l/meeting/new";
    if (url) window.open(url, "_blank", "noopener");
    log(channel, channel === "MEET" || channel === "TEAMS" ? "Meeting started" : channel === "CALL" ? "Called" : undefined);
  }

  const BTN = "flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-sm text-white/70 hover:border-gold/40 hover:text-gold disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || !digits} onClick={() => launch("WHATSAPP")} className={BTN}><MessageCircle className="h-4 w-4" /> WhatsApp</button>
        <button disabled={busy || !email} onClick={() => launch("EMAIL")} className={BTN}><Mail className="h-4 w-4" /> Email</button>
        <button disabled={busy || !e164} onClick={() => launch("CALL")} className={BTN}><Phone className="h-4 w-4" /> Call</button>
        <button disabled={busy} onClick={() => launch("MEET")} className={BTN}><Video className="h-4 w-4" /> Meet</button>
        <button disabled={busy} onClick={() => launch("TEAMS")} className={BTN}><Users className="h-4 w-4" /> Teams</button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (note.trim()) { log("NOTE", note.trim()); setNote(""); } }}
        className="flex gap-2"
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Log a note…"
          className="flex-1 rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
        />
        <button disabled={busy || !note.trim()} className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold-soft disabled:opacity-60">Add</button>
      </form>

      <Card className="space-y-3">
        {touches.length === 0 && <p className="text-sm text-white/40">No activity yet — start a conversation above.</p>}
        {touches.map((t) => {
          const Icon = ICON[t.channel] ?? StickyNote;
          return (
            <div key={t.id} className="flex gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
              <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-hairline bg-ink-900/50 text-gold">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-white/45">
                    {t.channel.toLowerCase()} · {t.direction.toLowerCase()}
                    {t.outcome ? ` · ${t.outcome}` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-white/30">{REL(t.at)}</span>
                </div>
                {t.body && <p className="mt-0.5 text-sm text-white/80">{t.body}</p>}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
