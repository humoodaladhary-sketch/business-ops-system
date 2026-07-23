// Calls the Supabase `dept-api` edge function. The edge function holds the
// database service role automatically, so the app needs NO Supabase env vars.
// The URL + token are non-secret and stay server-side.
const EDGE_URL = process.env.DEPT_API_URL || "https://hpxaaiaoasgoazpgilht.supabase.co/functions/v1/dept-api";
const EDGE_TOKEN = process.env.DEPT_API_TOKEN || "6e9342e74d7a4eb39720441a504ef6f33ba2c091638d3c85";

// Returns the parsed JSON, or a structured { error, detail } object so the UI
// can show exactly why a call failed instead of silently blanking.
export async function deptApi<T = unknown>(body: Record<string, unknown>): Promise<T> {
  try {
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sync-token": EDGE_TOKEN,
        // Also send the token as apikey/bearer — harmless, and satisfies the
        // Supabase gateway on setups that expect an auth header.
        apikey: EDGE_TOKEN,
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (!res.ok && json && typeof json === "object" && !("error" in json)) {
        return { ...json, error: `http_${res.status}` } as T;
      }
      return json as T;
    } catch {
      return { error: `http_${res.status}`, detail: text.slice(0, 240) || "empty response" } as T;
    }
  } catch (e) {
    return { error: "fetch_failed", detail: (e as Error).message.slice(0, 240) } as T;
  }
}
