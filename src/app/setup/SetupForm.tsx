"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELD = "w-full rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";
const LABEL = "mb-1 block text-xs uppercase tracking-wide text-white/45";

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("Humood AlAdhari");
  const [email, setEmail] = useState("humood@alwalaaoman.com");
  const [designation, setDesignation] = useState("CEO");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name, email, password, designation }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Setup failed (HTTP ${r.status}).`);
      } else {
        setDone(
          j.seedError
            ? `Account ${j.account}. ⚠ ${j.seedError}`
            : `Account ${j.account}. System seeded — redirecting to sign in…`,
        );
        if (!j.seedError) setTimeout(() => router.push("/login"), 2500);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-md border border-gold/30 bg-gold/10 p-4 text-sm text-gold">
        ✓ {done}
        <a href="/login" className="mt-2 block underline">Go to sign in →</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={LABEL}>Full name</label>
        <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Designation</label>
          <input className={FIELD} value={designation} onChange={(e) => setDesignation(e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Role</label>
          <input className={`${FIELD} opacity-60`} value="Super Admin" disabled />
        </div>
      </div>
      <div>
        <label className={LABEL}>Email (your sign-in)</label>
        <input className={FIELD} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className={LABEL}>Password (choose one, min 8 chars)</label>
        <input className={FIELD} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" />
      </div>
      <div>
        <label className={LABEL}>Setup token</label>
        <input className={FIELD} type="password" value={token} onChange={(e) => setToken(e.target.value)} required placeholder="INTERNAL_API_TOKEN from Vercel" />
        <p className="mt-1 text-[11px] text-white/35">The INTERNAL_API_TOKEN value you set in Vercel → Environment Variables.</p>
      </div>

      {error && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{error}</p>}

      <button disabled={busy} className="w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-soft disabled:opacity-60">
        {busy ? "Setting up…" : "Create Super Admin & seed system"}
      </button>
    </form>
  );
}
