/**
 * AI ingestion: turn arbitrary pasted text / extracted file text into a
 * validated Unit[]. Reuses the existing Anthropic client (lib/anthropic.ts).
 *
 * Contract:
 *   - Claude returns ONLY a JSON array of raw rows.
 *   - We strip fences, JSON.parse, then validate each row with zod
 *     (parseUnitRows) — invalid rows are dropped + reported, never thrown.
 *   - id and pricePerSqm are derived; importedAt is stamped here.
 */

import { runText, stripCodeFences } from "@/lib/anthropic";
import { parseUnitRows, type ParseResult } from "@/domain/inventory/unit";

const NORMALIZE_INSTRUCTION = `
TASK: Normalize raw real-estate developer inventory into structured rows.

You receive messy inventory text — WhatsApp messages, Excel paste, or PDF
table dumps — from Oman property developers. Convert it into a JSON ARRAY
of unit objects. Return ONLY the JSON array. No prose, no code fences.

Each object MUST use exactly these keys:
{
  "project": string,            // development / tower name
  "developer": string|null,     // developer company if stated
  "unitRef": string,            // unit number / code; if absent, synthesize a stable one from row position like "ROW-3"
  "unitType": one of ["studio","1BR","2BR","3BR","4BR+","villa","townhouse","penthouse","duplex","office","retail","land"],
  "bedrooms": number|null,
  "bathrooms": number|null,
  "sizeSqm": number|null,       // square METRES; convert from sqft if needed (sqft * 0.0929)
  "floor": string|null,
  "view": string|null,
  "priceOMR": number|null,      // Omani Rial as a plain number
  "status": one of ["available","reserved","sold"],
  "paymentPlan": string|null,
  "handoverDate": string|null,
  "itcEligible": boolean,
  "furnishing": one of ["unfurnished","semi","furnished"] or null,
  "notes": string|null,
  "sourceRaw": string           // the original line(s) this row came from, verbatim
}

RULES:
- Infer unitType from bedroom count or area cues (e.g. "2 bed" -> "2BR",
  "studio"/"std" -> "studio", a large standalone -> "villa").
- Coerce prices to plain numbers (strip "OMR", commas, "/-"). Assume the
  currency is OMR. If another currency is clearly stated, KEEP the number
  but say so in "notes" (e.g. "price stated in AED").
- itcEligible: set TRUE unless the source clearly says the unit is NOT
  freehold / not ITC / Omani-only. ITC freehold = foreign-ownership +
  residency eligible.
- NEVER invent values. Use null when a field is unknown.
- Always populate sourceRaw with the original text for that row (audit trail).
- One object per distinct unit. Expand ranges ("units 101-103") into
  separate rows when prices/sizes are per-unit; otherwise keep as one row
  and note the range.

INPUT:
`;

export interface NormalizeResult extends ParseResult {
  rawRowCount: number;
}

export async function normalizeInventory(rawText: string): Promise<NormalizeResult> {
  const trimmed = rawText.trim();
  if (!trimmed) return { units: [], errors: [], rawRowCount: 0 };

  const { text } = await runText({
    userPrompt: `${NORMALIZE_INSTRUCTION}\n${trimmed}`,
    maxTokens: 16_000,
  });

  const cleaned = stripCodeFences(text);
  let rows: unknown[];
  try {
    const parsed: unknown = JSON.parse(cleaned);
    rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { units?: unknown }).units)
        ? ((parsed as { units: unknown[] }).units)
        : [];
  } catch {
    // Last-ditch: pull the first [...] block out of the text.
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end > start) {
      try {
        rows = JSON.parse(cleaned.slice(start, end + 1)) as unknown[];
      } catch {
        rows = [];
      }
    } else {
      rows = [];
    }
  }

  const result = parseUnitRows(rows);
  return { ...result, rawRowCount: rows.length };
}
