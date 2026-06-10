import { describe, it, expect } from "vitest";
import { detectLanguage, extractBudget, hasResidencyIntent, matchProjectInterest } from "./extract";

describe("detectLanguage", () => {
  it("distinguishes Arabic from English", () => {
    expect(detectLanguage("مرحبا أريد شقة في مسقط")).toBe("ar");
    expect(detectLanguage("Hi, looking for a 2BR")).toBe("en");
  });
});

describe("extractBudget", () => {
  it("parses currency + magnitude", () => {
    expect(extractBudget("around 150,000 OMR")).toMatchObject({ amount: 150000, currency: "OMR" });
    expect(extractBudget("$200k")).toMatchObject({ amount: 200000, currency: "USD" });
    expect(extractBudget("budget 1.5m AED")).toMatchObject({ amount: 1500000, currency: "AED" });
  });
  it("ignores non-budget text and bare small numbers", () => {
    expect(extractBudget("call me tomorrow")).toBeNull();
    expect(extractBudget("unit 5")).toBeNull();
  });
});

describe("residency intent + project match", () => {
  it("detects residency intent (EN/AR)", () => {
    expect(hasResidencyIntent("I want residency in Oman")).toBe(true);
    expect(hasResidencyIntent("أبحث عن إقامة")).toBe(true);
    expect(hasResidencyIntent("just an investment")).toBe(false);
  });
  it("matches an active project by name/alias", () => {
    const projects = [{ id: "wz", name: "Wadi Zaha", aliases: ["wadi zaha"] }];
    expect(matchProjectInterest("interested in Wadi Zaha studio", projects)).toBe("wz");
    expect(matchProjectInterest("hello there", projects)).toBeNull();
  });
});
