import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { PROMPT_VERSION } from "@/lib/prompts/_system";
import { buildBuyerPrompt } from "@/lib/prompts/buyer";
import { getRoi, getUnit, upsertBuyer } from "@/lib/supabase/db";
import type { BuyerProfile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const unit = await getUnit(id);
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    const roi = await getRoi(id);
    const { data } = await runJson<BuyerProfile>({ userPrompt: buildBuyerPrompt(unit, roi), maxTokens: 3_000 });
    await upsertBuyer(id, { ...data }, `claude-opus-4-7:${PROMPT_VERSION}`);
    return NextResponse.json({ ok: true, buyer: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
