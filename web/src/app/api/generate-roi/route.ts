/** POST /api/generate-roi — ROI & liquidity scores for a unit. */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { buildRoiPrompt } from "@/lib/prompts/roi";
import type { RoiScores, Unit } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { unit } = (await req.json()) as { unit: Unit };
    if (!unit) return NextResponse.json({ error: "Missing unit" }, { status: 400 });
    const { data, usage } = await runJson<RoiScores>({
      userPrompt: buildRoiPrompt(unit),
      maxTokens: 3_000,
    });
    return NextResponse.json({ ok: true, usage, roi: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
