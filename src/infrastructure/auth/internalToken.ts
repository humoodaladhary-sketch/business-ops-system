// Shared guard for privileged, non-interactive endpoints: the ones a cron job,
// an n8n workflow or the guided setup page calls, where there is no user session
// to reason about.
//
// FAIL CLOSED. An unset or placeholder token means the endpoint is unavailable,
// never that it is open. The previous inline check in the sync route did the
// opposite — `if (!token) return true` — which left a live endpoint reachable by
// anyone the moment the env var was missing, exactly when it was least noticed.
//
// The comparison is length-safe and time-constant so a wrong token cannot be
// discovered a character at a time.
import { timingSafeEqual } from "node:crypto";

/** Values that look configured but are the shipped default. */
const PLACEHOLDERS = new Set(["change-me", "changeme", "todo", "secret", ""]);

export type TokenCheck =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** The configured token, or null when it is absent or still a placeholder. */
export function internalToken(): string | null {
  const t = process.env.INTERNAL_API_TOKEN?.trim();
  if (!t || PLACEHOLDERS.has(t.toLowerCase())) return null;
  return t;
}

export function internalTokenConfigured(): boolean {
  return internalToken() !== null;
}

/** Constant-time string comparison that does not leak length through timing. */
export function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, so compare digests of equal
  // length instead: hash both to a fixed width first.
  if (ab.length !== bb.length) {
    // Still burn a comparison so the failure path takes similar time.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Checks a caller-supplied token against INTERNAL_API_TOKEN.
 *
 * Returns 503 when the server has no token configured — the endpoint genuinely
 * cannot authorize anyone, and saying so is more useful than a bare 401.
 * Returns 401 when a token was configured and the caller's did not match.
 */
export function requireInternalToken(supplied: string | null | undefined): TokenCheck {
  const expected = internalToken();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error:
        "INTERNAL_API_TOKEN is not set. Add it under Vercel → Settings → Environment Variables and redeploy before using this endpoint.",
    };
  }
  if (!supplied || !secretsMatch(supplied, expected)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}

/**
 * Pulls the token out of the usual places, in order of preference:
 * an `Authorization: Bearer` header, the `x-internal-token` header, then the
 * `token` query parameter (last because query strings land in access logs).
 */
export function tokenFromRequest(req: {
  headers: { get(name: string): string | null };
  nextUrl?: { searchParams: URLSearchParams };
}): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = req.headers.get("x-internal-token");
  if (header) return header.trim();
  return req.nextUrl?.searchParams.get("token")?.trim() ?? null;
}
