import { z } from "zod";
import {
  LEAD_HEADER_ALIASES,
  normalizeHeader,
  parseEmail,
  parseOptionalDate,
  parsePhone,
  canonicalLeadSource,
} from "./parsers";
import { mapStage } from "./canonicalize";
import type { CanonicalStage } from "@/domain";

export const LeadInputSchema = z.object({
  name: z.string().min(1, "lead name required"),
  title: z.string().nullable(),
  contact: z.string().nullable(),
  email: z.string().nullable(),
  country: z.string().nullable(),
  nationality: z.string().nullable(),
  language: z.string().nullable(),
  budget: z.string().nullable(),
  purpose: z.string().nullable(),
  projectInterest: z.string().nullable(),
  source: z.enum(["ALWALAA_SOURCED", "AGENT_NETWORK"]),
  rawStage: z.string().nullable(),
  stage: z.string(),
  registeredOn: z.date().nullable(),
  lastFollowUp: z.date().nullable(),
  notes: z.string().nullable(),
});
export type LeadInput = z.infer<typeof LeadInputSchema>;

const nz = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s === "" || s === "-" ? null : s;
};

/** Reconcile the two stage-ish columns to one canonical stage (Deal Status wins). */
function resolveStage(leadStageRaw: unknown, dealStatusRaw: unknown): { raw: string | null; stage: CanonicalStage } {
  const ds = String(dealStatusRaw ?? "").trim();
  const ls = String(leadStageRaw ?? "").trim();
  const raw = ds || ls || null;
  if (ds) return { raw, stage: mapStage(ds, "NEGOTIATION") };
  if (ls) return { raw, stage: mapStage(ls, "QUALIFIED") };
  return { raw, stage: "NEW" };
}

export function validateLeadRecord(rec: Record<string, unknown>):
  | { ok: true; value: LeadInput }
  | { ok: false; errors: string[] } {
  const { raw, stage } = resolveStage(rec.leadStageRaw, rec.dealStatusRaw);
  const candidate = {
    name: String(rec.name ?? "").trim(),
    title: nz(rec.title),
    contact: parsePhone(rec.contact),
    email: parseEmail(rec.email),
    country: nz(rec.country),
    nationality: nz(rec.nationality),
    language: nz(rec.language),
    budget: nz(rec.budget),
    purpose: nz(rec.purpose),
    projectInterest: nz(rec.projectName) ?? nz(rec.areaPref),
    source: canonicalLeadSource(rec.leadSource),
    rawStage: raw,
    stage,
    registeredOn: parseOptionalDate(rec.registeredOn),
    lastFollowUp: parseOptionalDate(rec.lastFollowUp),
    notes: nz(rec.notes),
  };
  const parsed = LeadInputSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  return { ok: true, value: parsed.data };
}

export interface LeadIngestResult {
  valid: LeadInput[];
  errors: { rowIndex: number; raw: Record<string, string>; errors: string[] }[];
  rawRows: Record<string, string>[];
}

export function matrixToLeads(matrix: string[][]): LeadIngestResult {
  if (matrix.length === 0) return { valid: [], errors: [], rawRows: [] };

  // Find the header row (contains "lead name").
  let headerRow = 0;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    if (matrix[i].map(normalizeHeader).includes("lead name")) {
      headerRow = i;
      break;
    }
  }
  const headers = matrix[headerRow].map(normalizeHeader);

  const valid: LeadInput[] = [];
  const errors: LeadIngestResult["errors"] = [];
  const rawRows: Record<string, string>[] = [];

  for (let r = headerRow + 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const raw: Record<string, string> = {};
    const canonical: Record<string, unknown> = {};
    headers.forEach((h, c) => {
      const v = (cells[c] ?? "").toString();
      raw[h || `col${c}`] = v;
      const key = LEAD_HEADER_ALIASES[h];
      if (key) canonical[key] = v;
    });
    if (String(canonical.name ?? "").trim() === "") continue;
    rawRows.push(raw);
    const res = validateLeadRecord(canonical);
    if (res.ok) valid.push(res.value);
    else errors.push({ rowIndex: r, raw, errors: res.errors });
  }

  return { valid, errors, rawRows };
}
