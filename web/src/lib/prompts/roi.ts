/** ROI scoring prompt. See docs/PROMPT_TEMPLATES.md §5. */

import type { Unit } from "@/types";

export function buildRoiPrompt(unit: Unit): string {
  return `
TASK: Score this unit on investment fundamentals. Explain each score
using Muscat yield bands + ITC premium + supply/demand cues from the
system prompt. Do not invent market numbers.

=== UNIT ===
${JSON.stringify(unit, null, 2)}

=== RESPOND WITH JSON ===
{
  "rental_yield_low_pct": 7.0,
  "rental_yield_high_pct": 8.5,
  "demand_strength": 8,
  "liquidity_score": 7,
  "roi_score": 8,
  "appreciation_score": 9,
  "rationale": {
    "rental_yield": "2 sentences — why this band, what evidence",
    "demand_strength": "1-2 sentences",
    "liquidity_score": "1-2 sentences",
    "roi_score": "1-2 sentences",
    "appreciation_score": "1-2 sentences"
  }
}

Never leave a score null. If evidence is thin, still score and flag it
in the rationale.
`.trim();
}
