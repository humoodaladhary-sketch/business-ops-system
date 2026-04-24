/** Unit extraction prompt. See docs/PROMPT_TEMPLATES.md §2. */

import { ITC_ZONES } from "../oman-context";

export function buildExtractionPrompt(args: {
  excelRows: unknown[];
  brochureText: string;
  renderCaptions: string[];
  projectHint?: { name?: string; developer?: string; zone?: string };
}): string {
  return `
TASK: Extract and normalize the unit inventory for a real-estate project.

You are given:
- Excel rows (may have inconsistent column names; normalize intelligently)
- Text from brochure PDFs
- Image captions for renders / floor plans / masterplans
- A lookup list of known Oman ITC zones

=== KNOWN ITC ZONES (for ownership classification) ===
${ITC_ZONES.map((z) => `- ${z.zone}: ${z.notes}`).join("\n")}

=== PROJECT HINT (may be partial) ===
${JSON.stringify(args.projectHint ?? {}, null, 2)}

=== EXCEL ROWS (${args.excelRows.length}) ===
${JSON.stringify(args.excelRows.slice(0, 400), null, 2)}

=== BROCHURE TEXT (truncated) ===
${(args.brochureText ?? "").slice(0, 20_000)}

=== RENDER CAPTIONS ===
${args.renderCaptions.length ? args.renderCaptions.map((c) => "- " + c).join("\n") : "(none)"}

=== RULES ===
- Convert sqft → sqm when needed (1 sqft = 0.0929 sqm).
- If prices look like thousands or lakhs, detect and normalize to OMR.
- If the brochure/zone matches a known ITC zone, set ownership_type = "freehold_itc".
- Every extracted value must appear in the "fields" array with a source tag.
- Use "assumed" sparingly. Prefer "missing" when you'd have to guess.
- Do not fabricate prices, dates, or permit numbers.

=== RESPOND WITH JSON ===
{
  "project": {
    "name": "string",
    "developer": "string | null",
    "zone": "string | null",
    "ownership_type": "freehold_itc | usufruct | leasehold | unknown",
    "handover_date": "YYYY-MM-DD | null"
  },
  "units": [
    {
      "reference_id": "string (use the inventory's unit id / SKU)",
      "unit_number": "string | null",
      "unit_type": "studio|apartment|townhouse|villa|sky_villa|penthouse|duplex",
      "bedrooms": "integer | null",
      "bathrooms": "number | null",
      "area_sqm": "number | null",
      "price_omr": "number | null",
      "payment_plan": "string | null",
      "floor": "integer | null",
      "building": "string | null",
      "view": "string | null",
      "parking": "integer | null",
      "amenities": ["string"],
      "fields": [
        {
          "name": "string (one of the keys above)",
          "value": "string",
          "source": "extracted | inferred | assumed | missing",
          "source_file_id": "string | null",
          "confidence": 0.00,
          "reasoning": "1 sentence"
        }
      ]
    }
  ]
}
`.trim();
}
