/**
 * AI listing generation for a developer-inventory unit. Brand-aligned copy
 * in EN or AR. Reuses the existing Anthropic client.
 *
 * Also exports a no-AI template fallback so the UI/API always returns
 * something even if the API key is missing or a call fails.
 */

import { z } from "zod";
import { runText, stripCodeFences } from "@/lib/anthropic";
import { formatOmr, formatPerSqm } from "@/domain/inventory/money";
import type { Unit } from "@/domain/inventory/unit";

export const ListingCopySchema = z.object({
  headline: z.string(),
  keyFacts: z.array(z.string()),
  description: z.string(),
  cta: z.string(),
});
export type ListingCopy = z.infer<typeof ListingCopySchema>;

export type ListingLanguage = "en" | "ar";

function factLine(u: Unit): string[] {
  const facts: string[] = [];
  facts.push(`${u.unitType}${u.bedrooms != null ? ` · ${u.bedrooms} bed` : ""}${u.bathrooms != null ? ` · ${u.bathrooms} bath` : ""}`);
  if (u.sizeSqm != null) facts.push(`${u.sizeSqm} sqm`);
  if (u.priceOMR != null) facts.push(formatOmr(u.priceOMR));
  if (u.pricePerSqm != null) facts.push(formatPerSqm(u.pricePerSqm));
  if (u.view) facts.push(u.view);
  if (u.floor) facts.push(`Floor ${u.floor}`);
  if (u.itcEligible) facts.push("Freehold (ITC) — foreign ownership + residency");
  if (u.handoverDate) facts.push(`Handover ${u.handoverDate}`);
  return facts;
}

/** Deterministic, no-AI fallback. Brand-aligned, weighty, minimal. */
export function templateListing(unit: Unit, language: ListingLanguage): ListingCopy {
  const facts = factLine(unit);
  if (language === "ar") {
    return {
      headline: `${unit.project} — ${unit.unitType} للتملك الحر`,
      keyFacts: facts,
      description:
        `وحدة ${unit.unitType} في ${unit.project}` +
        (unit.itcEligible ? "، ضمن منطقة تملك حر (ITC) تتيح الملكية للأجانب والإقامة." : ".") +
        (unit.priceOMR != null ? ` السعر ${formatOmr(unit.priceOMR)}.` : "") +
        " الولاء العقارية — حيث يلتقي الولاء بالفخامة.",
      cta: "تواصل مع الولاء العقارية لحجز معاينتك الخاصة.",
    };
  }
  return {
    headline: `${unit.project} — ${unit.unitType} | Freehold (ITC)`,
    keyFacts: facts,
    description:
      `A ${unit.unitType} at ${unit.project}` +
      (unit.itcEligible
        ? ", within an ITC freehold zone — foreign ownership with residency eligibility."
        : ".") +
      (unit.priceOMR != null ? ` Priced at ${formatOmr(unit.priceOMR)}.` : "") +
      " Alwalaa Real Estate — where loyalty meets luxury.",
    cta: "Contact Alwalaa Real Estate to arrange your private viewing.",
  };
}

const GENERATE_INSTRUCTION = (language: ListingLanguage) => `
TASK: Write a brand-aligned property listing for ONE Alwalaa Real Estate unit
in ${language === "ar" ? "ARABIC" : "ENGLISH"}.

Brand voice: loyalty + luxury, minimal and weighty, investor-first. Black-and-
gold restraint — no exclamation marks, no "hot deal", no emoji spam. Lead with
the ITC freehold + Golden Residency angle when the unit is itcEligible.

Return ONLY this JSON object (no fences, no prose):
{
  "headline": string,        // one weighty line
  "keyFacts": string[],      // 4-7 scannable facts
  "description": string,     // 2-3 short paragraphs, minimal/luxury tone
  "cta": string              // one clear call to action
}

${language === "ar" ? "Write every field in Arabic (RTL), proper nouns excepted." : ""}

UNIT:
`;

export async function generateListing(
  unit: Unit,
  language: ListingLanguage,
): Promise<{ copy: ListingCopy; source: "ai" | "template" }> {
  try {
    const { text } = await runText({
      userPrompt: `${GENERATE_INSTRUCTION(language)}\n${JSON.stringify(unit, null, 2)}`,
      maxTokens: 2_000,
    });
    const parsed: unknown = JSON.parse(stripCodeFences(text));
    const copy = ListingCopySchema.parse(parsed);
    return { copy, source: "ai" };
  } catch {
    return { copy: templateListing(unit, language), source: "template" };
  }
}
