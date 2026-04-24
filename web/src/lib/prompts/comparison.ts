/** Comparison report prompt. See docs/PROMPT_TEMPLATES.md §6. */

import type { RoiScores, Unit } from "@/types";

export function buildComparisonPrompt(args: {
  units: Array<Unit & { roi?: RoiScores | null }>;
  clientBrief: string;
}): string {
  return `
TASK: Produce a comparison report for the ${args.units.length} units
provided, then craft a ready-to-send WhatsApp pitch summarizing the
recommendation.

=== CLIENT BRIEF ===
${args.clientBrief}

=== UNITS ===
${JSON.stringify(args.units, null, 2)}

=== RESPOND WITH JSON ===
{
  "comparison": {
    "columns": ["Price (OMR)","Size (sqm)","Rental Yield","ROI","Liquidity","Appreciation","Ownership"],
    "rows": [
      {
        "unit_id": "string",
        "title": "short unit label",
        "values": ["108,500","96","7.0-8.5%","8","7","9","Freehold (ITC)"],
        "pros": ["..."],
        "cons": ["..."]
      }
    ]
  },
  "recommendation": {
    "top_unit_id": "string",
    "reasoning": "2-3 short paragraphs: match-to-brief, ROI case, risk note"
  },
  "whatsapp_pitch": {
    "en": "4-6 short lines, investor-voice, CTA at end",
    "ar": "Arabic equivalent, RTL friendly"
  }
}

RULES:
- Recommendation must address the client brief explicitly.
- Pros/cons specific to each unit — not boilerplate.
- WhatsApp pitch: no emojis except •, no ALL CAPS.
`.trim();
}
