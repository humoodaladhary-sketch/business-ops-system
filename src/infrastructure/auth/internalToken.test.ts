import { afterEach, describe, expect, it } from "vitest";
import {
  internalToken,
  internalTokenConfigured,
  requireInternalToken,
  secretsMatch,
  tokenFromRequest,
} from "./internalToken";

const ORIGINAL = process.env.INTERNAL_API_TOKEN;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.INTERNAL_API_TOKEN;
  else process.env.INTERNAL_API_TOKEN = ORIGINAL;
});

function fakeRequest(headers: Record<string, string>, query?: Record<string, string>) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => h.get(name.toLowerCase()) ?? null },
    nextUrl: { searchParams: new URLSearchParams(query ?? {}) },
  };
}

describe("internalToken", () => {
  it("treats placeholders as unconfigured", () => {
    for (const v of ["change-me", "CHANGE-ME", "changeme", "todo", "secret", "  "]) {
      process.env.INTERNAL_API_TOKEN = v;
      expect(internalToken()).toBeNull();
      expect(internalTokenConfigured()).toBe(false);
    }
  });

  it("accepts a real token and trims it", () => {
    process.env.INTERNAL_API_TOKEN = "  a-real-token  ";
    expect(internalToken()).toBe("a-real-token");
    expect(internalTokenConfigured()).toBe(true);
  });

  it("treats an unset variable as unconfigured", () => {
    delete process.env.INTERNAL_API_TOKEN;
    expect(internalToken()).toBeNull();
  });
});

describe("requireInternalToken fails closed", () => {
  // The bug this replaces: `if (!token) return true` — a missing env var meant
  // the endpoint authorized everyone.
  it("refuses with 503 when no token is configured, even with a supplied token", () => {
    delete process.env.INTERNAL_API_TOKEN;
    expect(requireInternalToken("anything")).toMatchObject({ ok: false, status: 503 });
    expect(requireInternalToken(null)).toMatchObject({ ok: false, status: 503 });
  });

  it("refuses with 503 when the token is still the placeholder", () => {
    process.env.INTERNAL_API_TOKEN = "change-me";
    expect(requireInternalToken("change-me")).toMatchObject({ ok: false, status: 503 });
  });

  it("refuses with 401 when a configured token does not match", () => {
    process.env.INTERNAL_API_TOKEN = "correct-horse";
    for (const supplied of ["wrong", "", null, undefined, "correct-hors", "correct-horsee"]) {
      expect(requireInternalToken(supplied)).toMatchObject({ ok: false, status: 401 });
    }
  });

  it("admits an exact match", () => {
    process.env.INTERNAL_API_TOKEN = "correct-horse";
    expect(requireInternalToken("correct-horse")).toEqual({ ok: true });
  });
});

describe("secretsMatch", () => {
  it("compares by value and rejects length mismatches without throwing", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abc", "abd")).toBe(false);
    expect(secretsMatch("abc", "abcd")).toBe(false);
    expect(secretsMatch("", "")).toBe(true);
  });
});

describe("tokenFromRequest", () => {
  it("prefers an Authorization: Bearer header", () => {
    const req = fakeRequest({ authorization: "Bearer from-bearer", "x-internal-token": "from-header" }, { token: "from-query" });
    expect(tokenFromRequest(req)).toBe("from-bearer");
  });

  it("is case-insensitive about the Bearer scheme", () => {
    expect(tokenFromRequest(fakeRequest({ authorization: "bearer lowercase" }))).toBe("lowercase");
  });

  it("falls back to x-internal-token, then the query string", () => {
    expect(tokenFromRequest(fakeRequest({ "x-internal-token": "h" }, { token: "q" }))).toBe("h");
    expect(tokenFromRequest(fakeRequest({}, { token: "q" }))).toBe("q");
  });

  it("returns null when nothing is supplied", () => {
    expect(tokenFromRequest(fakeRequest({}))).toBeNull();
  });

  it("ignores a non-Bearer Authorization header", () => {
    expect(tokenFromRequest(fakeRequest({ authorization: "Basic abc" }, { token: "q" }))).toBe("q");
  });
});
