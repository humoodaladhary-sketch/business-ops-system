import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { buildPitchPrompt } from "@/lib/prompts/pitch";
import { getRoi, getUnit } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const unit = await getUnit(id);
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    const roi = await getRoi(id);
    const { data } = await runJson<{ en: string; ar: string }>({
      userPrompt: buildPitchPrompt(unit, roi),
      maxTokens: 2_000,
    });
    return NextResponse.json({ ok: true, pitch: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
