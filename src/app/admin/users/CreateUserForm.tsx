"use client";

import { useState } from "react";

const ROLES = [
  ["AGENT", "Advisor (sees own data)"],
  ["SALES_HEAD", "Sales Head"],
  ["FINANCE", "Finance"],
  ["MARKETING", "Marketing"],
  ["ADMIN", "Super Admin (sees all)"],
] as const;

export function CreateUserForm({ agents }: { agents: { id: string; name: string }[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("AGENT");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  // Creating a login mints a real Supabase account, so the endpoint requires
  // INTERNAL_API_TOKEN as well as an admin session — the same token the guided
  // /setup page asks for. It is held in component state only, never persisted.
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-token": token },
      body: JSON.stringify({ email, password, role, agentId: role === "AGENT" ? agentId : null }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: `Login created for ${email}.` });
      setEmail("");
      setPassword("");
    } else {
      setMsg({ ok: false, text: j.error || "Could not create the login." });
    }
  }

  const field = "w-full rounded-md border border-hairline bg-ink-100 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-white/50">Email (username)</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@alwalaaoman.com" className={field} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-white/50">Temporary password</label>
        <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 8 characters" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {role === "AGENT" && (
          <div>
            <label className="mb-1 block text-xs text-white/50">Linked advisor</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={field}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs text-white/50">Setup token</label>
        <input
          type="password"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="INTERNAL_API_TOKEN"
          autoComplete="off"
          className={field}
        />
        <p className="mt-1 text-[11px] text-white/35">
          The value of INTERNAL_API_TOKEN from your Vercel environment variables.
        </p>
      </div>
      {msg && <p className={msg.ok ? "text-sm text-emerald-300" : "text-sm text-risk"}>{msg.text}</p>}
      <button disabled={busy} className="w-full rounded-md bg-gold px-4 py-2.5 font-medium text-ink transition hover:bg-gold-soft disabled:opacity-60">
        {busy ? "Creating…" : "Create login"}
      </button>
    </form>
  );
}
