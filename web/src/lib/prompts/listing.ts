/** Platform-specific listing prompt. See docs/PROMPT_TEMPLATES.md §3. */

import type { Language, Platform, Unit, RoiScores } from "@/types";

export interface PlatformRules {
  title_max_chars: number;
  body_max_chars: number;
  hashtag_policy: boolean;
  tone_override?: string;
  sections: string[];
}

export const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  property_finder: {
    title_max_chars: 100,
    body_max_chars: 5000,
    hashtag_policy: false,
    sections: ["opener", "itc_advantage", "investment_case", "specifications", "next_step"],
  },
  olx_oman: {
    title_max_chars: 70,
    body_max_chars: 3000,
    hashtag_policy: false,
    tone_override: "scannable, fact-forward, investor-ready",
    sections: ["one_line_positioning", "bullets", "pitch_close"],
  },
  instagram: {
    title_max_chars: 150,
    body_max_chars: 2200,
    hashtag_policy: true,
    tone_override: "sensory, aspirational, investor-voice. Minimal emoji (only ✦ or ◆).",
    sections: ["hook", "body", "cta", "hashtags"],
  },
  whatsapp: {
    title_max_chars: 120,
    body_max_chars: 1200,
    hashtag_policy: false,
    tone_override: "direct, one-tap forwardable, bilingual. No emoji except a single • bullet.",
    sections: ["hook", "bullets", "cta"],
  },
  linkedin: {
    title_max_chars: 150,
    body_max_chars: 3000,
    hashtag_policy: true,
    tone_override: "investment-thesis tone, professional, case-study structured",
    sections: ["thesis_opener", "worked_example", "closing_insight"],
  },
  website: {
    title_max_chars: 120,
    body_max_chars: 6000,
    hashtag_policy: false,
    tone_override: "premium editorial; markdown allowed",
    sections: [
      "hero_headline",
      "subheadline",
      "key_highlights",
      "lifestyle_narrative",
      "specifications",
      "investment_case",
      "location",
      "pricing",
      "cta",
    ],
  },
};

export function buildListingPrompt(args: {
  unit: Unit;
  roi: RoiScores | null;
  platform: Platform;
  language: Language;
  renderCaptions: string[];
}): string {
  const rules = PLATFORM_RULES[args.platform];
  return `
TASK: Generate a publication-ready listing for the unit below on the
platform ${args.platform} in language ${args.language}.

=== PLATFORM RULES (enforce exactly) ===
${JSON.stringify(rules, null, 2)}

=== TITLE FORMAT (adjust if unit is NOT ITC-eligible — say so directly) ===
[Unit Type] | Freehold (ITC) for Foreigners | [Project / Zone] | [Key Feature] | OMR [Price]

=== DESCRIPTION MUST INCLUDE ===
- Lifestyle + investment positioning (short paragraph)
- Smart-city / ITC advantage if applicable
- ROI angle — cite the yield band from the ROI scores
- Rental demand framing (who rents in Muscat, target tenant)
- Capital appreciation thesis (only if supported by unit's project)
- Payment plan (if available)
- Foreign-ownership eligibility in ONE clear sentence
- Strong CTA from the approved list (never invent new ones)

=== BULLETS ===
- Bedrooms · Bathrooms · Area sqm
- Price OMR
- Parking, View
- Ownership: Freehold (ITC) | Usufruct | Omani/GCC only
- Handover date

${
  args.platform === "instagram"
    ? `=== INSTAGRAM SPECIAL ===
Caption ends with:
  --- divider ---
  Arabic version (if args.language = "ar")
  --- divider ---
  Hashtags: 20-30 — branded + location + unit type + investment keywords.
`
    : ""
}
${
  args.platform === "whatsapp"
    ? `=== WHATSAPP SPECIAL ===
Max 4 short paragraphs. Direct CTA with the phone number placeholder {CONTACT_WHATSAPP}.
`
    : ""
}

=== UNIT DATA ===
${JSON.stringify(args.unit, null, 2)}

=== ROI CONTEXT ===
${args.roi ? JSON.stringify(args.roi, null, 2) : "(ROI not yet scored — use the Oman yield band for the unit type as a conservative range.)"}

=== VISION CAPTIONS (from renders) ===
${args.renderCaptions.length ? args.renderCaptions.join("\n- ") : "(no renders provided)"}

=== RESPOND WITH JSON ===
{
  "title": "string (within ${rules.title_max_chars} chars)",
  "body":  "string (within ${rules.body_max_chars} chars)",
  "cta":   "string, from approved list",
  "hashtags": ${rules.hashtag_policy ? '["string", ...]' : "[]"}
}
`.trim();
}
