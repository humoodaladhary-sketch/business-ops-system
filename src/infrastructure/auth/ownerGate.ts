// An optional passcode lock for owner-only mode.
//
// The app runs without a login: `getSession()` resolves every caller to the
// owner. That is fine on a private deployment and wide open on a public URL —
// anyone with the link gets an ADMIN view of every lead, deal and commission.
//
// Setting OWNER_PASSCODE turns this gate on. It is deliberately opt-in: a
// deployment that has no passcode configured keeps working exactly as before,
// so enabling the lock is a decision, never an accident that locks the owner
// out of their own system. `ownerGateEnabled()` reports which state is live, and
// the UI says so out loud rather than leaving it to be assumed.
//
// The cookie holds an HMAC of a fixed label keyed by the passcode — never the
// passcode itself — so the stored value cannot be read back into the secret.
// Web Crypto is used rather than node:crypto because the middleware that checks
// this cookie runs on the edge runtime.

export const OWNER_COOKIE = "alwalaa_owner";

const LABEL = "alwalaa-owner-gate-v1";

/** Values that look configured but are a shipped placeholder. */
const PLACEHOLDERS = new Set(["", "change-me", "changeme", "passcode", "password"]);

/** The configured passcode, or null when absent or a placeholder. */
export function ownerPasscode(): string | null {
  const p = process.env.OWNER_PASSCODE?.trim();
  if (!p || PLACEHOLDERS.has(p.toLowerCase())) return null;
  return p;
}

/** True when the app is passcode-locked. False means it is open to anyone with the URL. */
export function ownerGateEnabled(): boolean {
  return ownerPasscode() !== null;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value proving the passcode was entered. Deterministic per passcode. */
export async function expectedCookieValue(passcode: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(LABEL)));
}

/** Constant-time comparison of two equal-purpose hex strings. */
export function hexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Whether this request carries a valid unlock cookie.
 * Always true when the gate is disabled — there is nothing to prove.
 */
export async function hasValidOwnerCookie(cookieValue: string | undefined): Promise<boolean> {
  const passcode = ownerPasscode();
  if (!passcode) return true;
  if (!cookieValue) return false;
  return hexEquals(cookieValue, await expectedCookieValue(passcode));
}

/** Checks a submitted passcode against the configured one. */
export async function passcodeMatches(submitted: string): Promise<boolean> {
  const passcode = ownerPasscode();
  if (!passcode) return false;
  // Web Crypto refuses a zero-length HMAC key, so an empty submission would
  // throw rather than simply failing. An empty passcode is never correct.
  if (!submitted) return false;
  // Compare via HMAC so the check is constant-time and length-independent.
  const [a, b] = await Promise.all([expectedCookieValue(submitted), expectedCookieValue(passcode)]);
  return hexEquals(a, b);
}
