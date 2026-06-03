"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/infrastructure/auth/browser";

export function SupabaseLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/` },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  if (sent) return <p className="text-center text-sm text-emerald-300">Check your email for the sign-in link.</p>;

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@alwalaaoman.com"
        className="w-full rounded-md border border-hairline bg-ink-100 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
      />
      {err && <p className="text-sm text-risk">{err}</p>}
      <button className="w-full rounded-md bg-gold px-4 py-2.5 font-medium text-ink hover:bg-gold-soft">
        Email me a sign-in link
      </button>
    </form>
  );
}
