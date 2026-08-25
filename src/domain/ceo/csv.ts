// Importing the 2026 deal book from CSV.
//
// The source sheet is authored in Arabic for advisor names and yes/no columns,
// and carries a `company_net_omr` column whose arithmetic disagrees with its own
// components by a baisa on some rows. We keep that column for reconciliation and
// recompute net from the formula — see `deals.ts`.
//
// Parsing is strict: an unrecognised advisor is an error, not a dropped row. A
// silently skipped deal is a number that is wrong in a way nobody notices.

import { omrStringToBaisa } from "./baisa";
import { parseMonthKey } from "./calendar";
import type { Deal, DealStage, TriState } from "./types";

export class CsvImportError extends Error {}

/** Minimal RFC 4180 reader: quoted fields, escaped quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const YES = new Set(["نعم", "yes", "y", "true", "1"]);
const NO = new Set(["لا", "no", "n", "false", "0"]);
const UNKNOWN = new Set(["؟", "?", "", "unknown", "tbd"]);

export function parseTriState(raw: string, column: string, ref: string): TriState {
  const v = raw.trim().toLowerCase();
  if (YES.has(v)) return "yes";
  if (NO.has(v)) return "no";
  if (UNKNOWN.has(v)) return "unknown";
  throw new CsvImportError(`Deal ${ref}: unrecognised ${column} value ${JSON.stringify(raw)}`);
}

const STAGES: Record<string, DealStage> = {
  SPA_SIGNED: "SPA_SIGNED",
  RESERVED: "RESERVED",
  CANCELLED: "CANCELLED",
};

export function parseStage(raw: string, ref: string): DealStage {
  const stage = STAGES[raw.trim().toUpperCase()];
  if (!stage) throw new CsvImportError(`Deal ${ref}: unrecognised deal_stage ${JSON.stringify(raw)}`);
  return stage;
}

function parsePct(raw: string, column: string, ref: string): number {
  const s = raw.trim();
  if (s === "") return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new CsvImportError(`Deal ${ref}: ${column} is not a number: ${JSON.stringify(raw)}`);
  }
  return n;
}

export interface ImportOptions {
  /**
   * Maps the advisor name as written in the sheet (Arabic or English) to a
   * `Person.id`. Built from the people seed so the mapping lives in data.
   */
  advisorIdByName: Readonly<Record<string, string>>;
}

const REQUIRED_COLUMNS = [
  "deal_ref",
  "month",
  "advisor",
  "developer",
  "unit_value_omr",
  "alwalaa_gross_commission_omr",
  "agent_amount_omr",
  "company_net_omr",
  "deal_stage",
] as const;

/** Parse the 2026 deal book. Throws on anything it cannot account for. */
export function importDealsCsv(text: string, opts: ImportOptions): Deal[] {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new CsvImportError("Deal CSV is empty.");
  const header = rows[0].map((h) => h.trim());
  const index = new Map(header.map((h, i) => [h, i]));

  for (const col of REQUIRED_COLUMNS) {
    if (!index.has(col)) throw new CsvImportError(`Deal CSV is missing required column "${col}".`);
  }
  const at = (row: string[], col: string): string => {
    const i = index.get(col);
    return i === undefined ? "" : (row[i] ?? "");
  };

  const seen = new Set<string>();
  const deals: Deal[] = [];

  for (const row of rows.slice(1)) {
    const ref = at(row, "deal_ref").trim();
    if (ref === "") throw new CsvImportError("Deal CSV has a row with no deal_ref.");
    if (seen.has(ref)) throw new CsvImportError(`Duplicate deal_ref ${ref} in the CSV.`);
    seen.add(ref);

    const month = at(row, "month").trim();
    parseMonthKey(month);

    const advisorName = at(row, "advisor").trim();
    const advisorId = opts.advisorIdByName[advisorName];
    if (!advisorId) {
      throw new CsvImportError(
        `Deal ${ref}: advisor ${JSON.stringify(advisorName)} is not in the people seed. ` +
          `Add them (archived if they have left) rather than dropping the deal.`,
      );
    }

    const referralPayee = at(row, "referral_payee").trim();
    deals.push({
      ref,
      month,
      advisorId,
      developer: at(row, "developer").trim(),
      project: at(row, "project").trim(),
      unitType: at(row, "unit_type").trim(),
      unitValueBaisa: omrStringToBaisa(at(row, "unit_value_omr")),
      commissionPct: parsePct(at(row, "commission_pct"), "commission_pct", ref),
      grossCommissionBaisa: omrStringToBaisa(at(row, "alwalaa_gross_commission_omr")),
      incentiveBaisa: omrStringToBaisa(at(row, "incentive_omr")),
      referralPayee: referralPayee === "" ? null : referralPayee,
      referralPct: parsePct(at(row, "referral_pct"), "referral_pct", ref),
      referralBaisa: omrStringToBaisa(at(row, "referral_amount_omr")),
      agentCutPct: parsePct(at(row, "agent_cut_pct"), "agent_cut_pct", ref),
      agentAmountBaisa: omrStringToBaisa(at(row, "agent_amount_omr")),
      recordedCompanyNetBaisa: omrStringToBaisa(at(row, "company_net_omr")),
      stage: parseStage(at(row, "deal_stage"), ref),
      invoiced: parseTriState(at(row, "invoiced"), "invoiced", ref),
      collected: parseTriState(at(row, "collected"), "collected", ref),
    });
  }
  return deals;
}
