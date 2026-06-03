/**
 * POST /api/inventory/commit
 *
 * Body:  { units: Unit[] }   (the confirmed rows from a /normalize preview)
 * Returns: UpsertReport       (inserted / updated / unchanged / movements)
 *
 * Re-validates every unit with the canonical schema before writing.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UnitSchema } from "@/domain/inventory/unit";
import { getInventoryRepository } from "@/storage/inventory";

export const runtime = "nodejs";

const BodySchema = z.object({ units: z.array(UnitSchema).min(1) });

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json(
        { error: "Body must be { units: Unit[] }", issues: body.error.issues },
        { status: 400 },
      );
    }
    const repo = getInventoryRepository();
    const report = await repo.upsertMany(body.data.units);
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("commit error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
