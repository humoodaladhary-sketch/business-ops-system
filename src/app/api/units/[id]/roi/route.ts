import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { PROMPT_VERSION } from "@/lib/prompts/_system";
import { buildRoiPrompt } from "@/lib/prompts/roi";
import { getUnit, upsertRoi } from "@/lib/supabase/db";
import type { RoiScores } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const unit = await getUnit(id);
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    const { data } = await runJson<RoiScores>({ userPrompt: buildRoiPrompt(unit), maxTokens: 3_000 });
    await upsertRoi(id, { ...data }, `claude-opus-4-7:${PROMPT_VERSION}`);
    return NextResponse.json({ ok: true, roi: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
