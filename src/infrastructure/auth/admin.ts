import { createClient } from "@supabase/supabase-js";

/** Service-role Supabase client for user provisioning (server only). */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function adminConfigured(): boolean {
  return Boolean(
    process.env.AUTH_PROVIDER === "supabase" &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
