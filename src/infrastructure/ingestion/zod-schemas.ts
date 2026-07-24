import { z } from "zod";
import {
  parseMoney,
  parseOptionalDate,
  parseOptionalMoney,
  parsePercentToFraction,
  parsePhone,
  parseEmail,
  canonicalLeadSource,
} from "./parsers";

// Clean, validated shape of one deal row after parsing.
export const DealInputSchema = z.object({
  clientName: z.string().min(1, "client name required"),
  contact: z.string().nullable(),
  email: z.string().nullable(),
  developerName: z.string().min(1, "developer required"),
  projectName: z.string().min(1, "project required"),
  unitType: z.string().nullable(),
  unitNumber: z.string().nullable(),
  developerRate: z.number().positive("developer rate required"),
  dealValue: z.number().positive("deal value required"),
  stageRaw: z.string().nullable(),
  closeDate: z.date().nullable(),
  agentSplitRaw: z.number().nullable(),
  leadSource: z.enum(["ALWALAA_SOURCED", "AGENT_NETWORK"]),
  devPaid: z.enum(["RECEIVED", "NOT_RECEIVED"]),
  agentPaid: z.enum(["PAID", "NOT_PAID"]),
});
export type DealInput = z.infer<typeof DealInputSchema>;

const RECEIVED = /reciev|receiv/i;
const PAID = /^paid/i;

export type RowResult =
  | { ok: true; value: DealInput }
  | { ok: false; errors: string[] };

/** Map one record (already keyed by canonical field names) to a clean DealInput. */
export function validateDealRecord(rec: Record<string, unknown>): RowResult {
  const errors: string[] = [];
  const tryParse = <T>(label: string, fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message}`);
      return fallback;
    }
  };

  const candidate = {
    clientName: String(rec.clientName ?? "").trim(),
    contact: tryParse("contact", () => parsePhone(rec.contact), null),
    email: tryParse("email", () => parseEmail(rec.email), null),
    developerName: String(rec.developerName ?? "").trim(),
    projectName: String(rec.projectName ?? "").trim(),
    unitType: nullableStr(rec.unitType),
    unitNumber: nullableStr(rec.unitNumber),
    developerRate: tryParse("developerRate", () => parsePercentToFraction(rec.developerPct), NaN),
    dealValue: tryParse("dealValue", () => parseMoney(rec.dealValue), NaN),
    stageRaw: nullableStr(rec.stageRaw),
    closeDate: parseOptionalDate(rec.closeDate),
    agentSplitRaw: rec.agentPct == null || String(rec.agentPct).trim() === ""
      ? null
      : tryParse("agentPct", () => parsePercentToFraction(rec.agentPct), null),
    leadSource: canonicalLeadSource(rec.leadSource),
    devPaid: RECEIVED.test(String(rec.devPaidRaw ?? "")) ? "RECEIVED" : "NOT_RECEIVED",
    agentPaid: PAID.test(String(rec.agentPaidRaw ?? "").trim()) ? "PAID" : "NOT_PAID",
  };

  const parsed = DealInputSchema.safeParse(candidate);
  if (!parsed.success) {
    errors.push(...parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: parsed.data! };
}

function nullableStr(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" || s === "-" ? null : s;
}

// Re-exported so callers needn't reach into parsers for the optional money path.
export { parseOptionalMoney };
