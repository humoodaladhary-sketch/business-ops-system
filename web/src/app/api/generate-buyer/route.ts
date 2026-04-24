/** POST /api/generate-buyer — ideal buyer profile prediction. */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { buildBuyerPrompt } from "@/lib/prompts/buyer";
import type { BuyerProfile, RoiScores, Unit } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { unit, roi } = (await req.json()) as { unit: Unit; roi?: RoiScores };
    if (!unit) return NextResponse.json({ error: "Missing unit" }, { status: 400 });
    const { data, usage } = await runJson<BuyerProfile>({
      userPrompt: buildBuyerPrompt(unit, roi ?? null),
      maxTokens: 3_000,
    });
    return NextResponse.json({ ok: true, usage, buyer: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
