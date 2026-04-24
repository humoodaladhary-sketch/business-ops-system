/**
 * POST /api/reports/comparison
 *
 * Body: { unitIds: string[], clientBrief: string }
 * Output: saved report in reports table, returns { reportId }.
 */

import { NextRequest, NextResponse } from "next/server";
import { runJson } from "@/lib/anthropic";
import { PROMPT_VERSION } from "@/lib/prompts/_system";
import { buildComparisonPrompt } from "@/lib/prompts/comparison";
import {
  getOrCreateDefaultOrgId,
  getRoi,
  getUnit,
  insertReport,
} from "@/lib/supabase/db";
import type { ComparisonReport, RoiScores, Unit } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { unitIds, clientBrief } = (await req.json()) as {
      unitIds: string[];
      clientBrief: string;
    };
    if (!unitIds?.length) return NextResponse.json({ error: "No unitIds" }, { status: 400 });

    const units: Array<Unit & { roi?: RoiScores | null }> = [];
    for (const id of unitIds) {
      const u = await getUnit(id);
      if (u) {
        const roi = await getRoi(id);
        units.push({ ...u, roi });
      }
    }
    if (!units.length) return NextResponse.json({ error: "Units not found" }, { status: 404 });

    const { data } = await runJson<ComparisonReport>({
      userPrompt: buildComparisonPrompt({ units, clientBrief: clientBrief ?? "" }),
      maxTokens: 6_000,
    });

    const org = await getOrCreateDefaultOrgId();
    const saved = await insertReport({
      organization_id: org,
      type: "comparison",
      title: clientBrief.slice(0, 140) || `${unitIds.length}-unit comparison`,
      input_filter: { clientBrief, unitIds },
      unit_ids: unitIds,
      body_markdown: JSON.stringify(data, null, 2),
      whatsapp_pitch: `${data.whatsapp_pitch.en}\n\n— — —\n\n${data.whatsapp_pitch.ar}`,
      model_version: `claude-opus-4-7:${PROMPT_VERSION}`,
    });

    return NextResponse.json({ ok: true, reportId: (saved as { id: string }).id, report: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
