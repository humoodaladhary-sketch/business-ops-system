"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function UnlockForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        // Only ever return to a path on this app, never an absolute URL.
        router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
        router.refresh();
      } else {
        setErr(j.error ?? "Could not unlock.");
      }
    } catch {
      setErr("Network error — please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Owner passcode"
        aria-label="Owner passcode"
        className="w-full rounded-md border border-hairline bg-ink-100 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
      />
      {err && <p className="text-sm text-risk">{err}</p>}
      <button
        disabled={busy || !passcode}
        className="w-full rounded-md bg-gold px-4 py-2.5 font-medium text-ink transition hover:bg-gold-soft disabled:opacity-60"
      >
        {busy ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}
