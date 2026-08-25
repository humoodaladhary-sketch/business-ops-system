import { afterEach, describe, expect, it } from "vitest";
import {
  expectedCookieValue,
  hasValidOwnerCookie,
  hexEquals,
  ownerGateEnabled,
  ownerPasscode,
  passcodeMatches,
} from "./ownerGate";

const ORIGINAL = process.env.OWNER_PASSCODE;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.OWNER_PASSCODE;
  else process.env.OWNER_PASSCODE = ORIGINAL;
});

describe("the gate is opt-in", () => {
  it("is off when no passcode is configured", () => {
    delete process.env.OWNER_PASSCODE;
    expect(ownerGateEnabled()).toBe(false);
    expect(ownerPasscode()).toBeNull();
  });

  it("treats placeholders as not configured, so a stub never pretends to be a lock", () => {
    for (const v of ["change-me", "PASSWORD", "passcode", "  "]) {
      process.env.OWNER_PASSCODE = v;
      expect(ownerGateEnabled()).toBe(false);
    }
  });

  it("is on once a real passcode is set", () => {
    process.env.OWNER_PASSCODE = "a-real-passcode";
    expect(ownerGateEnabled()).toBe(true);
  });
});

describe("cookie verification", () => {
  it("lets everything through while the gate is off", async () => {
    delete process.env.OWNER_PASSCODE;
    expect(await hasValidOwnerCookie(undefined)).toBe(true);
    expect(await hasValidOwnerCookie("nonsense")).toBe(true);
  });

  it("requires a cookie once the gate is on", async () => {
    process.env.OWNER_PASSCODE = "a-real-passcode";
    expect(await hasValidOwnerCookie(undefined)).toBe(false);
    expect(await hasValidOwnerCookie("")).toBe(false);
    expect(await hasValidOwnerCookie("forged")).toBe(false);
  });

  it("accepts the cookie the unlock endpoint issues", async () => {
    process.env.OWNER_PASSCODE = "a-real-passcode";
    expect(await hasValidOwnerCookie(await expectedCookieValue("a-real-passcode"))).toBe(true);
  });

  it("rejects a cookie minted from a different passcode", async () => {
    process.env.OWNER_PASSCODE = "a-real-passcode";
    expect(await hasValidOwnerCookie(await expectedCookieValue("another-passcode"))).toBe(false);
  });

  it("never stores the passcode itself in the cookie", async () => {
    const value = await expectedCookieValue("a-real-passcode");
    expect(value).not.toContain("a-real-passcode");
    expect(value).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("passcodeMatches", () => {
  it("accepts the configured passcode and rejects everything else", async () => {
    process.env.OWNER_PASSCODE = "a-real-passcode";
    expect(await passcodeMatches("a-real-passcode")).toBe(true);
    expect(await passcodeMatches("a-real-passcod")).toBe(false);
    expect(await passcodeMatches("A-Real-Passcode")).toBe(false);
    expect(await passcodeMatches("")).toBe(false);
  });

  it("refuses everything when no passcode is configured", async () => {
    delete process.env.OWNER_PASSCODE;
    expect(await passcodeMatches("anything")).toBe(false);
    expect(await passcodeMatches("")).toBe(false);
  });
});

describe("hexEquals", () => {
  it("compares equal-length strings by value", () => {
    expect(hexEquals("abcd", "abcd")).toBe(true);
    expect(hexEquals("abcd", "abce")).toBe(false);
  });

  it("rejects mismatched lengths", () => {
    expect(hexEquals("ab", "abc")).toBe(false);
  });
});
