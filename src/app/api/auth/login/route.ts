import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_COOKIE, isSupabaseConfigured, supabaseServer, type Session } from "@/infrastructure/auth/session";
import { AGENTS } from "@/app/_data/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// Until the database is connected, accept a shared preview password and map the
// email to a role. Real per-user passwords come from Supabase (created by the
// Super Admin under User Access).
const ADMIN_EMAILS = ["ceo@alwalaaoman.com", "admin@alwalaaoman.com", "humood@alwalaaoman.com"];

function previewSession(email: string, password: string): Session | null {
  if (password !== (process.env.DEMO_PASSWORD || "alwalaa2026")) return null;
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

  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer().auth.signInWithPassword({ email, password });
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
