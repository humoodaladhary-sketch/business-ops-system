/**
 * Canonical developer-inventory unit schema.
 *
 * Pure domain layer — zero IO, zero React, zero fetch. This file (and the
 * rest of `domain/`) must port cleanly into N8N functions and the WhatsApp
 * bot, so it depends only on `zod`.
 *
 * Field casing is camelCase (idiomatic TS, matches the repo's `lib/` style).
 * Money is always OMR.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const UnitType = z.enum([
  "studio",
  "1BR",
  "2BR",
  "3BR",
  "4BR+",
  "villa",
  "townhouse",
  "penthouse",
  "duplex",
  "office",
  "retail",
  "land",
]);
export type UnitType = z.infer<typeof UnitType>;

export const Status = z.enum(["available", "reserved", "sold"]);
export type Status = z.infer<typeof Status>;

export const Furnishing = z.enum(["unfurnished", "semi", "furnished"]);
export type Furnishing = z.infer<typeof Furnishing>;

// ---------------------------------------------------------------------------
// Coercion helpers (lenient parsing of messy developer input)
// ---------------------------------------------------------------------------

/**
 * Parse a possibly-messy numeric value ("OMR 108,500", "215 sqm", "", null)
 * into a number or null. Never throws — unknown becomes null so the row can
 * still be reported rather than crashing the batch.
 */
const nullableNumber = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().nullable());

const nullableInt = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9\-]/g, "");
    if (cleaned === "" || cleaned === "-") return null;
    const n = Number.parseInt(cleaned, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}, z.number().int().nullable());

const nullableString = z.preprocess((v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}, z.string().nullable());

// ---------------------------------------------------------------------------
// Canonical Unit (strict — the validated, stored shape)
// ---------------------------------------------------------------------------

export const UnitSchema = z.object({
  id: z.string().min(1), // derived: `${project}|${unitRef}` slugified
  project: z.string().min(1),
  developer: z.string().min(1),
  unitRef: z.string().min(1),
  unitType: UnitType,
  bedrooms: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  sizeSqm: z.number().positive().nullable(),
  floor: z.string().nullable(),
  view: z.string().nullable(),
  priceOMR: z.number().positive().nullable(),
  pricePerSqm: z.number().positive().nullable(), // derived
  status: Status,
  paymentPlan: z.string().nullable(),
  handoverDate: z.string().nullable(),
  itcEligible: z.boolean(), // residency-qualifying
  furnishing: Furnishing.nullable(),
  sourceRaw: z.string(), // original line, for audit
  importedAt: z.string(), // ISO
  notes: z.string().nullable(),
});
export type Unit = z.infer<typeof UnitSchema>;

// ---------------------------------------------------------------------------
// Draft Unit (lenient — what the AI returns, before derivation/validation)
// ---------------------------------------------------------------------------

export const UnitDraftSchema = z.object({
  project: z.string().min(1),
  developer: nullableString.transform((v) => v ?? "Unknown developer"),
  unitRef: z.string().min(1),
  unitType: UnitType,
  bedrooms: nullableInt,
  bathrooms: nullableInt,
  sizeSqm: nullableNumber,
  floor: nullableString,
  view: nullableString,
  priceOMR: nullableNumber,
  status: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    Status.catch("available"),
  ),
  paymentPlan: nullableString,
  handoverDate: nullableString,
  itcEligible: z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return !/^(false|no|0)$/i.test(v.trim());
    if (v === null || v === undefined) return true; // default true per spec
    return Boolean(v);
  }, z.boolean()),
  furnishing: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    Furnishing.nullable().catch(null),
  ),
  notes: nullableString,
  sourceRaw: z.string().default(""),
});
export type UnitDraft = z.infer<typeof UnitDraftSchema>;

// ---------------------------------------------------------------------------
// Derivations (pure)
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Stable unit id from project + unitRef. */
export function deriveId(project: string, unitRef: string): string {
  return `${slugify(project)}|${slugify(unitRef)}`;
}

/** Price per sqm, rounded to the nearest OMR, or null when inputs are absent. */
export function derivePricePerSqm(
  priceOMR: number | null,
  sizeSqm: number | null,
): number | null {
  if (priceOMR == null || sizeSqm == null || sizeSqm <= 0) return null;
  const v = Math.round(priceOMR / sizeSqm);
  return v > 0 ? v : null;
}

/**
 * Promote a validated draft to a canonical Unit: derive `id`, `pricePerSqm`,
 * stamp `importedAt`. Throws (via zod) only if the resulting shape is invalid
 * — callers run this inside a safe wrapper to drop+report bad rows.
 */
export function toUnit(draft: UnitDraft, importedAt: string = new Date().toISOString()): Unit {
  const candidate = {
    id: deriveId(draft.project, draft.unitRef),
    project: draft.project,
    developer: draft.developer,
    unitRef: draft.unitRef,
    unitType: draft.unitType,
    bedrooms: draft.bedrooms,
    bathrooms: draft.bathrooms,
    sizeSqm: draft.sizeSqm,
    floor: draft.floor,
    view: draft.view,
    priceOMR: draft.priceOMR,
    pricePerSqm: derivePricePerSqm(draft.priceOMR, draft.sizeSqm),
    status: draft.status,
    paymentPlan: draft.paymentPlan,
    handoverDate: draft.handoverDate,
    itcEligible: draft.itcEligible,
    furnishing: draft.furnishing,
    sourceRaw: draft.sourceRaw,
    importedAt,
    notes: draft.notes,
  };
  return UnitSchema.parse(candidate);
}

// ---------------------------------------------------------------------------
// Batch validation result (drop + report, never throw on bad rows)
// ---------------------------------------------------------------------------

export interface RowError {
  index: number;
  message: string;
  raw: unknown;
}

export interface ParseResult {
  units: Unit[];
  errors: RowError[];
}

/**
 * Validate an array of unknown rows (e.g. the AI's JSON output) into canonical
 * units. Invalid rows are collected in `errors` rather than throwing.
 */
export function parseUnitRows(rows: unknown[], importedAt?: string): ParseResult {
  const units: Unit[] = [];
  const errors: RowError[] = [];
  rows.forEach((row, index) => {
    const draft = UnitDraftSchema.safeParse(row);
    if (!draft.success) {
      errors.push({ index, message: draft.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), raw: row });
      return;
    }
    try {
      units.push(toUnit(draft.data, importedAt));
    } catch (e) {
      errors.push({ index, message: (e as Error).message, raw: row });
    }
  });
  return { units, errors };
}
