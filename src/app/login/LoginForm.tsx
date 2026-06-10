"use client";

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (r.ok) {
      window.location.href = "/";
      return;
    }
    const j = await r.json().catch(() => ({}));
    setErr(j.error || "Sign in failed.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-white/50">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@alwalaaoman.com"
          autoComplete="username"
          className="w-full rounded-md border border-hairline bg-ink-100 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-white/50">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-md border border-hairline bg-ink-100 px-3 py-2.5 text-white focus:border-gold/50 focus:outline-none"
        />
      </div>
      {err && <p className="text-sm text-risk">{err}</p>}
      <button
        disabled={busy}
        className="w-full rounded-md bg-gold px-4 py-2.5 font-medium text-ink transition hover:bg-gold-soft disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
