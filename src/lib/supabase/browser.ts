/** Browser-side Supabase client for user auth + row-level-secure reads. */

import { createClient } from "@supabase/supabase-js";

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase public env vars");
  return createClient(url, key);
}
