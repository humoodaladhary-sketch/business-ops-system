import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client (service role) for the department copilots.
// In owner-only mode there is no per-user auth, so the copilots read/write with
// the service role. NEVER import this into a client component.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!cached) cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

export const supabaseConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
