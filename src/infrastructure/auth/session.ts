// Server-side auth/session. Uses Supabase when configured
// (NEXT_PUBLIC_SUPABASE_URL + anon key), otherwise a signed-by-httpOnly demo
// cookie so the app is fully usable on the preview. Authorization scoping below
// is the real enforcement at the app layer; RLS (supabase/migrations) enforces
// it again at the database for production.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export type Role = "ADMIN" | "AGENT";

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: Role;
  agentId: string | null; // null for admins
}

export const DEMO_COOKIE = "alwalaa_demo_session";

export function isSupabaseConfigured(): boolean {
  // Real auth turns on automatically when valid Supabase keys are present
  // (the service-role key is the tell — placeholders never carry one), or
  // explicitly via AUTH_PROVIDER=supabase. Set AUTH_PROVIDER=preview to force
  // demo mode even when keys exist.
  if (process.env.AUTH_PROVIDER === "preview") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (process.env.AUTH_PROVIDER !== "supabase" && !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function supabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options as never));
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    },
  );
}

function getDemoSession(): Session | null {
  const raw = cookies().get(DEMO_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  // Owner-only mode: the app is private to you — no login, no agent accounts.
  // Always resolve to the owner with full (ADMIN) access. The Supabase/demo
  // auth code below is kept for when multi-user access is re-enabled.
  return {
    userId: "owner",
    email: process.env.OWNER_EMAIL ?? "humood@alwalaaoman.com",
    name: "Humood AlAdhari",
    role: "ADMIN",
    agentId: null,
  };
}

// Preserved for a future multi-user mode (currently unused).
export async function getSessionMultiUser(): Promise<Session | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabaseServer().auth.getUser();
      const user = data.user;
      if (!user) return getDemoSession();
      const meta = (user.app_metadata ?? {}) as { role?: Role; agent_id?: string };
      return {
        userId: user.id,
        email: user.email ?? "",
        name: (user.user_metadata?.name as string) ?? user.email ?? "User",
        role: meta.role ?? "AGENT",
        agentId: meta.agent_id ?? null,
      };
    } catch {
      return getDemoSession();
    }
  }
  return getDemoSession();
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export const isAdmin = (s: Session | null): boolean => s?.role === "ADMIN";

/** Which agent's data a session may see in a scoped view: 'ALL' for admins. */
export function visibleScope(s: Session): string | "ALL" {
  return s.role === "ADMIN" ? "ALL" : s.agentId ?? "__none__";
}

/** Whether a session may view a particular agent's private workspace. */
export function canViewAgent(s: Session, agentId: string): boolean {
  return s.role === "ADMIN" || s.agentId === agentId;
}
