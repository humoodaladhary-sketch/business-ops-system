/** POST /api/generate-pitch — bilingual WhatsApp pitch. */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { buildPitchPrompt } from "@/lib/prompts/pitch";
import type { RoiScores, Unit } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { unit, roi } = (await req.json()) as { unit: Unit; roi?: RoiScores };
    if (!unit) return NextResponse.json({ error: "Missing unit" }, { status: 400 });
    const { data, usage } = await runJson<{ en: string; ar: string }>({
      userPrompt: buildPitchPrompt(unit, roi ?? null),
      maxTokens: 2_000,
    });
    return NextResponse.json({ ok: true, usage, pitch: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
