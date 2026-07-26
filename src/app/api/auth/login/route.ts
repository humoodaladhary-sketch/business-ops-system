import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_COOKIE, isSupabaseConfigured, supabaseServer, type Session } from "@/infrastructure/auth/session";
import { adminConfigured } from "@/infrastructure/auth/admin";
import { claimFirstAdmin } from "@/app/api/admin/bootstrap/seed";
import { AGENTS } from "@/app/_data/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Until the database is connected, accept a shared preview password and map the
// email to a role. Real per-user passwords come from Supabase (created by the
// Super Admin under User Access).
const ADMIN_EMAILS = ["ceo@alwalaaoman.com", "admin@alwalaaoman.com", "humood@alwalaaoman.com"];

function previewSession(email: string, password: string): Session | null {
  // Preview login only exists when DEMO_PASSWORD is explicitly set — this repo
  // is public, so a hardcoded fallback password would be a published credential.
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || password !== demoPassword) return null;
  const e = email.toLowerCase().trim();
  if (ADMIN_EMAILS.includes(e)) return { userId: "ceo", email: e, name: "Super Admin", role: "ADMIN", agentId: null };
  const local = e.split("@")[0];
  const agent = AGENTS.find((a) => a.id === local && a.status !== "FORMER");
  if (agent) return { userId: agent.id, email: e, name: agent.name, role: "AGENT", agentId: agent.id };
  return null;
}

export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  const { email, password } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  // TEMPORARY owner-recovery hatch (remove in Phase 6 once Supabase auth is
  // verified). Guarantees the CEO can sign in regardless of the Supabase /
  // preview state while auth is being wired. It issues a demo admin cookie;
  // getSession() falls back to that cookie even in Supabase mode, so it works
  // in both. Gated to the single owner email + a recovery password.
  // Active only when OWNER_RECOVERY_PASSWORD is explicitly set in the env —
  // never from a value committed to this public repo.
  const recoveryEmail = (process.env.OWNER_EMAIL || "humood@alwalaaoman.com").toLowerCase();
  const recoveryPassword = process.env.OWNER_RECOVERY_PASSWORD;
  if (recoveryPassword && emailNorm === recoveryEmail && password === recoveryPassword) {
    const session: Session = { userId: "ceo", email: recoveryEmail, name: "Humood AlAdhari", role: "ADMIN", agentId: null };
    const res = NextResponse.json({ ok: true, recovery: true });
    res.cookies.set(DEMO_COOKIE, JSON.stringify(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  }

  if (isSupabaseConfigured()) {
    const supa = supabaseServer();
    let { error } = await supa.auth.signInWithPassword({ email, password });
    // First-run: if no admin exists yet, this sign-in claims the Super Admin
    // account with the password just entered, then signs in. Closed once an
    // admin exists, so it cannot be used as a backdoor later.
    if (error && adminConfigured()) {
      const claim = await claimFirstAdmin(email, password);
      if (claim.claimed) ({ error } = await supa.auth.signInWithPassword({ email, password }));
    }
    if (error) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    return NextResponse.json({ ok: true });
  }

  const session = previewSession(email, password);
  if (!session) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
