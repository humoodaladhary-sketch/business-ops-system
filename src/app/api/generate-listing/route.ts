/**
 * POST /api/generate-listing
 *
 * Body: { unit: Unit, roi?: RoiScores, platform: Platform, language: Language,
 *         renderCaptions?: string[] }
 * Returns: { title, body, cta, hashtags }
 *
 * This route is stateless by design so it can be called with any unit —
 * even one that's not yet persisted. Persistence is wired in the next
 * milestone via /api/units/[id]/generate which loads from DB then calls
 * this logic.
 */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { buildListingPrompt, PLATFORM_RULES } from "@/lib/prompts/listing";
import type { Language, Platform, RoiScores, Unit } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  unit: Unit;
  roi?: RoiScores;
  platform: Platform;
  language: Language;
  renderCaptions?: string[];
}

interface ListingPayload {
  title: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.unit || !body.platform || !body.language) {
      return NextResponse.json({ error: "Missing unit, platform, or language" }, { status: 400 });
    }

    const prompt = buildListingPrompt({
      unit: body.unit,
      roi: body.roi ?? null,
      platform: body.platform,
      language: body.language,
      renderCaptions: body.renderCaptions ?? [],
    });

    const { data, usage } = await runJson<ListingPayload>({ userPrompt: prompt });

    // Enforce platform limits (best-effort truncate with warning)
    const rules = PLATFORM_RULES[body.platform];
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

    return NextResponse.json({
      ok: true,
      usage,
      listing: {
        platform: body.platform,
        language: body.language,
        title,
        body: bodyText,
        cta: data.cta ?? "",
        hashtags: data.hashtags ?? [],
        warnings,
      },
    });
  } catch (err) {
    console.error("generate-listing error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
