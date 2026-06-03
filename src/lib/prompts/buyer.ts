/** Buyer profile prompt. See docs/PROMPT_TEMPLATES.md §4. */

import type { RoiScores, Unit } from "@/types";

export function buildBuyerPrompt(unit: Unit, roi: RoiScores | null): string {
  return `
TASK: Predict the ideal buyer profile for THIS unit. Be specific, not
generic. Reference Oman market dynamics from the system prompt.

=== UNIT ===
${JSON.stringify(unit, null, 2)}

=== ROI CONTEXT ===
${roi ? JSON.stringify(roi, null, 2) : "(not scored)"}

=== RESPOND WITH JSON ===
{
  "primary_buyer": "investor|end_user_family|luxury|first_time|foreign_expat|gcc_buyer",
  "secondary_buyer": "<same enum or null>",
  "best_nationalities": ["string", "string", "string"],
  "motivation": "1 sentence — why THIS buyer wants THIS unit",
  "expected_rental_audience": "1 sentence — if leased, who rents",
  "sales_angle": "1 sentence — the pitch",
  "objections": [
    {"objection": "string", "response": "string"}
  ]
}

For ITC-eligible units, the motivation MUST mention residency-linked
ownership if the primary buyer is foreign. Nationality ranking should be
evidence-based — tied to real Muscat buyer patterns.
`.trim();
}
