// Calls the Supabase `dept-api` edge function. The edge function holds the
// database service role automatically, so the app needs NO Supabase env vars.
// The URL + token are non-secret and stay server-side.
const EDGE_URL = process.env.DEPT_API_URL || "https://hpxaaiaoasgoazpgilht.supabase.co/functions/v1/dept-api";
const EDGE_TOKEN = process.env.DEPT_API_TOKEN || "6e9342e74d7a4eb39720441a504ef6f33ba2c091638d3c85";

export async function deptApi<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-token": EDGE_TOKEN },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}
