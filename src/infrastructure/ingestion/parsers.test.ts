import { describe, it, expect } from "vitest";
import {
  parseMoney,
  parseOptionalMoney,
  parsePercentToFraction,
  parseDate,
  parseOptionalDate,
  parsePhone,
  parseEmail,
  normalizeHeader,
  canonicalLeadSource,
  DEAL_HEADER_ALIASES,
  ParseError,
} from "./parsers";

describe("parseMoney — real sheet values", () => {
  it("strips commas, OMR suffix and padding", () => {
    expect(parseMoney("43,500.00  OMR ")).toBe(43500);
    expect(parseMoney("173,920.00  OMR ")).toBe(173920);
    expect(parseMoney("1,875.06")).toBe(1875.06);
  });
  it("passes numbers through", () => {
    expect(parseMoney(62914.5)).toBe(62914.5);
  });
  it("rejects #VALUE! and free text", () => {
    expect(() => parseMoney("#VALUE!")).toThrow(ParseError);
    expect(() => parseMoney("SPA pending")).toThrow(ParseError);
  });
  it("treats blank as null when optional", () => {
    expect(parseOptionalMoney("  ")).toBeNull();
    expect(parseOptionalMoney("0.00  OMR ")).toBe(0);
  });
});

describe("parsePercentToFraction", () => {
  it("converts developer and agent percents", () => {
    expect(parsePercentToFraction("3.5")).toBe(0.035);
    expect(parsePercentToFraction("35")).toBe(0.35);
    expect(parsePercentToFraction("50")).toBe(0.5);
  });
});

describe("parseDate — mixed locales & dirty cells", () => {
  it("parses US M/D/Y", () => {
    expect(parseDate("10/30/2025").toISOString()).toBe("2025-10-30T00:00:00.000Z");
  });
  it("parses EU D/M/Y when day > 12", () => {
    expect(parseDate("28/01/2026").toISOString()).toBe("2026-01-28T00:00:00.000Z");
    expect(parseDate("12/29/2025").toISOString()).toBe("2025-12-29T00:00:00.000Z");
  });
  it("rejects the real typo year 2926", () => {
    expect(() => parseDate("3/19/2926")).toThrow(ParseError);
  });
  it("rejects text-in-date", () => {
    expect(() => parseDate("SPA pending")).toThrow(ParseError);
    expect(parseOptionalDate("On Progress")).toBeNull();
    expect(parseOptionalDate("#VALUE!")).toBeNull();
  });
});

describe("parsePhone — invisibles & punctuation", () => {
  it("normalizes to + and digits, stripping direction marks and nb-hyphen", () => {
    expect(parsePhone("‪+1 (267) 824‑0809‬")).toBe("+12678240809");
    expect(parsePhone("61 470 210 734")).toBe("61470210734");
    expect(parsePhone("447896531201")).toBe("447896531201");
  });
  it("treats dash/blank as null", () => {
    expect(parsePhone("-")).toBeNull();
    expect(parsePhone("")).toBeNull();
  });
});

describe("parseEmail", () => {
  it("strips trailing tabs and takes the first of joint addresses", () => {
    expect(parseEmail("entezar@comp2i.com\t")).toBe("entezar@comp2i.com");
    expect(parseEmail("vmaennl@yahoo.de and uschi.koster@yahoo.de")).toBe("vmaennl@yahoo.de");
  });
  it("treats placeholder dashes as null", () => {
    expect(parseEmail("\\-")).toBeNull();
    expect(parseEmail("-")).toBeNull();
  });
});

describe("header normalization", () => {
  it("maps misspelled/padded headers to canonical keys", () => {
    expect(DEAL_HEADER_ALIASES[normalizeHeader("Develoepr Name")]).toBe("developerName");
    expect(DEAL_HEADER_ALIASES[normalizeHeader("Client Email Adress ")]).toBe("email");
    expect(DEAL_HEADER_ALIASES[normalizeHeader("Property Value ( excld vat ) Based on SPA")]).toBe("dealValue");
    expect(DEAL_HEADER_ALIASES[normalizeHeader("My Comission %")]).toBe("agentPct");
  });
});

describe("canonicalLeadSource", () => {
  it("maps own/referral to agent network, else Alwalaa", () => {
    expect(canonicalLeadSource("My Own Lead")).toBe("AGENT_NETWORK");
    expect(canonicalLeadSource("Referral Leads")).toBe("AGENT_NETWORK");
    expect(canonicalLeadSource("Alwalaa Leads ")).toBe("ALWALAA_SOURCED");
  });
});
