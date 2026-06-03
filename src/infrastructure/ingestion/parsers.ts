// Pure parsing/cleaning helpers, derived directly from the Phase 0 audit of the
// real agent sheets. Every quirk seen in the data has a rule here. These throw
// on unrecoverable input so the Zod layer can reject-and-log the row.

export class ParseError extends Error {}

const OMR_NOISE = /\s*OMR\s*/gi;
// Unicode direction marks & exotic spaces that appear inside phone cells.
const INVISIBLES = /[‎‏‪-‮  ⁠]/g;

/** "43,500.00  OMR " -> 43500.0 ; "1,875.06" -> 1875.06 ; rejects "#VALUE!". */
export function parseMoney(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const cleaned = String(raw ?? "")
    .replace(INVISIBLES, "")
    .replace(OMR_NOISE, "")
    .replace(/,/g, "")
    .trim();
  if (cleaned === "") throw new ParseError("empty money value");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) throw new ParseError(`not a number: "${raw}"`);
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new ParseError(`not finite: "${raw}"`);
  return n;
}

export function parseOptionalMoney(raw: unknown): number | null {
  const s = String(raw ?? "").replace(OMR_NOISE, "").replace(/,/g, "").trim();
  if (s === "") return null;
  return parseMoney(raw);
}

/** Percent text -> fraction. "3.5" -> 0.035, "35" -> 0.35, "50" -> 0.5. */
export function parsePercentToFraction(raw: unknown): number {
  const cleaned = String(raw ?? "").replace(/%/g, "").trim();
  if (cleaned === "") throw new ParseError("empty percent value");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) throw new ParseError(`not a percent: "${raw}"`);
  return Number(cleaned) / 100;
}

const NON_DATE = /^(spa pending|on progress|pending|n\/?a|#value!?|-|tbd)$/i;

/**
 * Resolve the dirty date column. Handles US "M/D/Y" and EU "D/M/Y" in the same
 * column, rejects text-in-date ("SPA pending", "#VALUE!"), and rejects
 * impossible years (the real typo "3/19/2926").
 */
export function parseDate(raw: unknown): Date {
  if (raw instanceof Date) return raw;
  const s = String(raw ?? "").replace(INVISIBLES, "").trim();
  if (s === "" || NON_DATE.test(s)) throw new ParseError(`not a date: "${raw}"`);

  const parts = s.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length !== 3) throw new ParseError(`unrecognized date: "${raw}"`);

  let [a, b, c] = parts.map(Number);
  if ([a, b, c].some((n) => Number.isNaN(n))) throw new ParseError(`unrecognized date: "${raw}"`);

  // Identify the year (4-digit, or the part > 31).
  let year: number, m: number, day: number;
  if (c > 31) {
    year = c;
    // a,b = month/day in some order. >12 disambiguates; else assume US M/D.
    if (a > 12 && b <= 12) { day = a; m = b; }
    else { m = a; day = b; }
  } else if (a > 31) {
    year = a; m = b; day = c; // Y/M/D
  } else {
    throw new ParseError(`ambiguous date: "${raw}"`);
  }

  if (m < 1 || m > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    throw new ParseError(`out-of-range date: "${raw}"`);
  }
  return new Date(Date.UTC(year, m - 1, day));
}

export function parseOptionalDate(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (s === "" || NON_DATE.test(s)) return null;
  try {
    return parseDate(raw);
  } catch {
    return null;
  }
}

/** Normalize a messy phone to "+" + digits; strips invisibles and punctuation. */
export function parsePhone(raw: unknown): string | null {
  const s = String(raw ?? "").replace(INVISIBLES, "").trim();
  if (s === "" || s === "-") return null;
  const hasPlus = s.trimStart().startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  if (digits === "") return null;
  return (hasPlus ? "+" : "") + digits;
}

export function parseEmail(raw: unknown): string | null {
  const s = String(raw ?? "").replace(INVISIBLES, "").replace(/\t/g, "").trim();
  if (s === "" || s === "-" || s === "\\-") return null;
  // A cell may contain two addresses ("a@x.com and b@y.com"); keep the first.
  const first = s.split(/\s+(?:and|&)\s+|[,;]/i)[0].trim();
  return /\S+@\S+\.\S+/.test(first) ? first.toLowerCase() : null;
}

/** Header normalizer: lowercase, collapse whitespace, drop trailing punctuation. */
export function normalizeHeader(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").replace(/[:.]+$/, "").trim();
}

// Misspelled/space-padded source headers -> canonical field keys (Deals tab).
export const DEAL_HEADER_ALIASES: Record<string, string> = {
  "s/n": "sn",
  "client name": "clientName",
  "client contact number": "contact",
  "client email adress": "email",
  "develoepr name": "developerName",
  "developer name": "developerName",
  "project name": "projectName",
  "unit type": "unitType",
  "unit number": "unitNumber",
  "alwalaa comission %": "developerPct",
  "property value ( excld vat ) based on spa": "dealValue",
  "deal stage": "stageRaw",
  "deal closed on (date)": "closeDate",
  "alwalaa net ( exld vat ) commission from developer": "alwalaaGrossRaw",
  "my comission %": "agentPct",
  "lead source": "leadSource",
};

// Lead source text -> canonical enum.
export function canonicalLeadSource(raw: unknown): "ALWALAA_SOURCED" | "AGENT_NETWORK" {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("own") || s.includes("referral") || s.includes("my own")) return "AGENT_NETWORK";
  return "ALWALAA_SOURCED";
}
