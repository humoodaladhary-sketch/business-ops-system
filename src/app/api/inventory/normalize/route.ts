/**
 * POST /api/inventory/normalize
 *
 * Body:  { text: string }
 * Returns: {
 *   units: Unit[],            // validated, derived
 *   errors: RowError[],       // dropped rows with reasons
 *   preview: PreviewRow[],    // new / price-changed / changed / unchanged vs stored
 *   rawRowCount: number
 * }
 *
 * Does NOT persist — the UI (or N8N) confirms before calling /commit.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeInventory } from "@/ai/normalizeInventory";
import { getInventoryRepository, previewDiff } from "@/storage/inventory";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({ text: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: "Body must be { text: string }" }, { status: 400 });
    }

    const result = await normalizeInventory(body.data.text);

    const repo = getInventoryRepository();
    const existing = new Map((await repo.getAll()).map((u) => [u.id, u]));
    const preview = previewDiff(existing, result.units);

    return NextResponse.json({
      ok: true,
      units: result.units,
      errors: result.errors,
      preview,
      rawRowCount: result.rawRowCount,
    });
  } catch (err) {
    console.error("normalize error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
