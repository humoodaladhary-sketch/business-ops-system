/** POST /api/generate-comparison — comparison report + WhatsApp pitch. */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { buildComparisonPrompt } from "@/lib/prompts/comparison";
import type { ComparisonReport, RoiScores, Unit } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 90;

interface Body {
  units: Array<Unit & { roi?: RoiScores | null }>;
  clientBrief: string;
}

export async function POST(req: NextRequest) {
  try {
    const { units, clientBrief } = (await req.json()) as Body;
    if (!units?.length) return NextResponse.json({ error: "No units supplied" }, { status: 400 });
    const { data, usage } = await runJson<ComparisonReport>({
      userPrompt: buildComparisonPrompt({ units, clientBrief: clientBrief ?? "" }),
      maxTokens: 6_000,
    });
    return NextResponse.json({ ok: true, usage, report: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
