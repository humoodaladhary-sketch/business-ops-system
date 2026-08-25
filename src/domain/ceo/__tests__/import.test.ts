// Importing the deal book. Parsing is strict on purpose: a silently skipped row
// is a number that is wrong in a way nobody notices. Every rejection here is a
// row that would otherwise have quietly changed a lifetime return.
import { describe, expect, it } from "vitest";

import { MoneyParseError } from "../baisa";
import { CsvImportError, importDealsCsv, parseCsv } from "../csv";
import { SeedError, loadPeople, loadSettings } from "../seed";
import { dataset } from "./fixtures";

const HEADER =
  "deal_ref,month,advisor,developer,project,unit_type,unit_value_omr,commission_pct," +
  "alwalaa_gross_commission_omr,incentive_omr,referral_payee,referral_pct,referral_amount_omr," +
  "agent_cut_pct,agent_amount_omr,company_net_omr,deal_stage,invoiced,collected";
const ROW = "T-1,2026-01,شذى,Sarooj,Oasis,1BHK,100000,3,3000,0,,0,0,35,1050,1950,SPA_SIGNED,نعم,نعم";
const OPTS = { advisorIdByName: { "شذى": "shatha" } };

describe("the CSV reader", () => {
  it("handles quoted fields, escaped quotes, CRLF and a BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x,1","he said ""hi"""\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x,1", 'he said "hi"'],
    ]);
  });

  it("ignores blank lines rather than emitting empty rows", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("importing deals", () => {
  it("reads Arabic yes/no and the unknown marker", () => {
    const [deal] = importDealsCsv(`${HEADER}\n${ROW}`, OPTS);
    expect(deal.invoiced).toBe("yes");
    expect(deal.collected).toBe("yes");

    const unknown = importDealsCsv(`${HEADER}\n${ROW.replace(/نعم,نعم$/, "؟,لا")}`, OPTS);
    expect(unknown[0].invoiced).toBe("unknown");
    expect(unknown[0].collected).toBe("no");
  });

  it("refuses a deal whose advisor is not in the people seed", () => {
    const row = ROW.replace("شذى", "مجهول");
    expect(() => importDealsCsv(`${HEADER}\n${row}`, OPTS)).toThrow(CsvImportError);
    expect(() => importDealsCsv(`${HEADER}\n${row}`, OPTS)).toThrow(/not in the people seed/);
  });

  it("refuses a duplicate deal reference", () => {
    expect(() => importDealsCsv(`${HEADER}\n${ROW}\n${ROW}`, OPTS)).toThrow(/Duplicate deal_ref/);
  });

  it("refuses a missing required column", () => {
    const header = HEADER.replace(",company_net_omr", "");
    expect(() => importDealsCsv(`${header}\n${ROW}`, OPTS)).toThrow(/missing required column/);
  });

  it("refuses an unrecognised stage or yes/no value", () => {
    expect(() => importDealsCsv(`${HEADER}\n${ROW.replace("SPA_SIGNED", "MAYBE")}`, OPTS)).toThrow(
      /unrecognised deal_stage/,
    );
    expect(() => importDealsCsv(`${HEADER}\n${ROW.replace(/نعم,نعم$/, "نعم,ربما")}`, OPTS)).toThrow(
      /unrecognised collected/,
    );
  });

  it("refuses sub-baisa precision rather than truncating it", () => {
    expect(() => importDealsCsv(`${HEADER}\n${ROW.replace("100000", "100000.1234")}`, OPTS)).toThrow(
      MoneyParseError,
    );
  });

  it("keeps the sheet's own net column for reconciliation", () => {
    const [deal] = importDealsCsv(`${HEADER}\n${ROW}`, OPTS);
    expect(deal.recordedCompanyNetBaisa).toBe(1_950_000);
    expect(deal.grossCommissionBaisa - deal.agentAmountBaisa).toBe(1_950_000);
  });
});

describe("the shipped book", () => {
  it("maps every Arabic advisor name to a seeded person", () => {
    const byAdvisor = new Map<string, number>();
    for (const deal of dataset().deals) {
      byAdvisor.set(deal.advisorId, (byAdvisor.get(deal.advisorId) ?? 0) + 1);
    }
    expect([...byAdvisor.entries()].sort()).toEqual([
      ["alex", 4],
      ["humood", 4],
      ["pasha", 4],
      ["shatha", 21],
      ["wesam", 5],
    ]);
  });

  it("carries the unknown invoicing state honestly rather than as 'no'", () => {
    const unknowns = dataset().deals.filter((d) => d.invoiced === "unknown");
    expect(unknowns.map((d) => d.ref).sort()).toEqual(["HUM-0002", "HUM-0003", "HUM-0004", "HUM-0005"]);
  });
});

describe("the seed loader validates as it loads", () => {
  it("rejects a duplicate person id", () => {
    const person = {
      id: "x", name: { en: "X", ar: "س" }, role: { en: "R", ar: "ر" },
      personClass: "Advisor", payrollClass: "Contractor", costTreatment: "operating",
      basicOmr: "1.000", allowanceOmr: "0.000", commissionCutPct: 0,
      measurementStartDate: "2026-01-01", hireDate: null, endedAt: null,
    };
    expect(() => loadPeople({ people: [person, person] })).toThrow(/duplicate person id/);
  });

  it("rejects an unknown person class", () => {
    expect(() =>
      loadPeople({
        people: [{
          id: "x", name: { en: "X", ar: "س" }, role: { en: "R", ar: "ر" },
          personClass: "Wizard", payrollClass: "Contractor", costTreatment: "operating",
          basicOmr: "1.000", allowanceOmr: "0.000", commissionCutPct: 0,
          measurementStartDate: "2026-01-01", hireDate: null, endedAt: null,
        }],
      }),
    ).toThrow(SeedError);
  });

  it("rejects an end date before the measurement baseline", () => {
    expect(() =>
      loadPeople({
        people: [{
          id: "x", name: { en: "X", ar: "س" }, role: { en: "R", ar: "ر" },
          personClass: "Advisor", payrollClass: "Contractor", costTreatment: "operating",
          basicOmr: "1.000", allowanceOmr: "0.000", commissionCutPct: 0,
          measurementStartDate: "2026-06-01", hireDate: null, endedAt: "2026-03-01",
        }],
      }),
    ).toThrow(/endedAt is before measurementStartDate/);
  });

  it("rejects an alias claimed by two people", () => {
    const base = {
      name: { en: "A", ar: "أ" }, role: { en: "R", ar: "ر" },
      personClass: "Advisor", payrollClass: "Contractor", costTreatment: "operating",
      basicOmr: "1.000", allowanceOmr: "0.000", commissionCutPct: 0,
      measurementStartDate: "2026-01-01", hireDate: null, endedAt: null,
    };
    expect(() =>
      loadPeople({
        people: [
          { ...base, id: "one", aliases: ["shared"] },
          { ...base, id: "two", name: { en: "B", ar: "ب" }, aliases: ["shared"] },
        ],
      }),
    ).toThrow(/maps to both/);
  });

  it("rejects a bonus band whose ceiling is not above its floor", () => {
    expect(() =>
      loadSettings({
        advisorMonthlyTargetOmr: "250000.000",
        targetBandOmr: "60000.000",
        holidays: [],
        bonusBands: [{
          id: "bad", label: { en: "Bad", ar: "سيئ" },
          minVolumeOmr: "100.000", maxVolumeOmr: "100.000", bonusOmr: "0.000",
        }],
      }),
    ).toThrow(/not above min volume/);
  });

  it("loads every bilingual label as an authored pair", () => {
    for (const person of dataset().people) {
      expect(person.name.en.length).toBeGreaterThan(0);
      expect(person.name.ar.length).toBeGreaterThan(0);
      expect(person.role.en.length).toBeGreaterThan(0);
      expect(person.role.ar.length).toBeGreaterThan(0);
    }
    for (const policy of dataset().costPolicies) {
      expect(policy.label.ar.length).toBeGreaterThan(0);
      for (const line of policy.overheads) expect(line.label.ar.length).toBeGreaterThan(0);
    }
  });
});
