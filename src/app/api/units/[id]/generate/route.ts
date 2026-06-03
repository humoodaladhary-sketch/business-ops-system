/**
 * POST /api/units/[id]/generate
 *
 * Generates listings for every (platform × language) the unit should have,
 * and persists them.
 *
 * Body (optional): { platforms?: Platform[], languages?: Language[] }
 *
 * Returns: { listings: Listing[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { PROMPT_VERSION } from "@/lib/prompts/_system";
import { buildListingPrompt, PLATFORM_RULES } from "@/lib/prompts/listing";
import {
  getOrCreateDefaultOrgId,
  getRoi,
  getUnit,
  listListings,
  upsertListing,
} from "@/lib/supabase/db";
import type { Language, Platform } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 240;

/** Default matrix: every platform × both languages (where they apply). */
const DEFAULT_MATRIX: Array<{ platform: Platform; languages: Language[] }> = [
  { platform: "property_finder", languages: ["en"] },
  { platform: "olx_oman", languages: ["en", "ar"] },
  { platform: "instagram", languages: ["en"] }, // bilingual handled inside the caption
  { platform: "whatsapp", languages: ["en"] },  // bilingual handled inside the text
  { platform: "linkedin", languages: ["en"] },
  { platform: "website", languages: ["en", "ar"] },
];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const unit = await getUnit(id);
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

    const organization_id = await getOrCreateDefaultOrgId();
    const roi = await getRoi(id);

    const body = (await req.json().catch(() => ({}))) as {
      platforms?: Platform[];
      languages?: Language[];
    };

    const matrix =
      body.platforms && body.platforms.length > 0
        ? body.platforms.map((p) => ({ platform: p, languages: body.languages ?? ["en"] }))
        : DEFAULT_MATRIX;

    // Run all (platform × language) in parallel — small bounded fan-out.
    const jobs: Promise<void>[] = [];
    for (const m of matrix) {
      for (const language of m.languages) {
        jobs.push(
          (async () => {
            const prompt = buildListingPrompt({
              unit,
              roi,
              platform: m.platform,
              language,
              renderCaptions: [],
            });
            const { data } = await runJson<{
              title: string;
              body: string;
              cta: string;
              hashtags: string[];
            }>({ userPrompt: prompt });

            const rules = PLATFORM_RULES[m.platform];
            const warnings: string[] = [];
            let title = data.title ?? "";
            let bodyText = data.body ?? "";
            if (title.length > rules.title_max_chars) {
              warnings.push(`title exceeded ${rules.title_max_chars} chars; truncated`);
              title = title.slice(0, rules.title_max_chars - 1).trimEnd() + "…";
            }
            if (bodyText.length > rules.body_max_chars) {
              warnings.push(`body exceeded ${rules.body_max_chars} chars; truncated`);
              bodyText = bodyText.slice(0, rules.body_max_chars - 1).trimEnd() + "…";
            }

            await upsertListing({
              organization_id,
              unit_id: id,
              platform: m.platform,
              language,
              title,
              body: bodyText,
              cta: data.cta,
              hashtags: data.hashtags ?? [],
              warnings,
              model_version: "claude-opus-4-7",
              prompt_hash: PROMPT_VERSION,
            });
          })(),
        );
      }
    }

    // Bounded concurrency: run in batches of 3 to avoid rate limits.
    const batchSize = 3;
    for (let i = 0; i < jobs.length; i += batchSize) {
      await Promise.all(jobs.slice(i, i + batchSize));
    }

    const listings = await listListings(id);
    return NextResponse.json({ ok: true, listings });
  } catch (err) {
    console.error("generate error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: listingId } = await ctx.params;
    const { title, body } = (await req.json()) as { title?: string; body: string };
    const { updateListingBody } = await import("@/lib/supabase/db");
    await updateListingBody(listingId, body, title);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
