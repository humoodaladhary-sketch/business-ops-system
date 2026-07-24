import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client (service role) for the department copilots.
// In owner-only mode there is no per-user auth, so the copilots read/write with
// the service role. NEVER import this into a client component.
let cached: SupabaseClient | null = null;

// The project URL is public (it is the same host already hardcoded in deptApi),
// so default it — that way enabling the copilot's full live-data tool-loop needs
// only the one secret value, SUPABASE_SERVICE_ROLE_KEY.
const DEFAULT_URL = "https://hpxaaiaoasgoazpgilht.supabase.co";

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  if (!cached) cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export const supabaseConfigured = (): boolean => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
