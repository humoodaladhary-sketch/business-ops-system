/** WhatsApp pitch prompt. See docs/PROMPT_TEMPLATES.md §7. */

import type { RoiScores, Unit } from "@/types";
import { CONTACT } from "../oman-context";

export function buildPitchPrompt(unit: Unit, roi: RoiScores | null): string {
  return `
TASK: Write a bilingual WhatsApp pitch for the unit below. English first,
then Arabic. Output must be one-tap forwardable.

=== FORMAT (strict, per language) ===
Line 1: Hook — one-line investor angle.
Line 2: (blank)
Line 3-6: Bulleted facts (• bullet only) — unit · price + payment plan · ownership · yield/appreciation.
Line 7: (blank)
Line 8: CTA: "WhatsApp ${CONTACT.whatsapp} — ${CONTACT.brand_name}"

Between languages, insert a line "— — —".

No emojis except the bullet •. No exclamation marks. Max 8 lines per language.

=== UNIT ===
${JSON.stringify(unit, null, 2)}

=== ROI ===
${roi ? JSON.stringify(roi, null, 2) : "(not scored — use Muscat yield band)"}

=== RESPOND WITH JSON ===
{"en": "string", "ar": "string"}
`.trim();
}
