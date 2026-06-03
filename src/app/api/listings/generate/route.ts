/**
 * POST /api/listings/generate
 *
 * Body: { unit: Unit, language: "en" | "ar" }
 * Returns: { copy: ListingCopy, source: "ai" | "template" }
 *
 * Falls back to a deterministic template if the AI call fails, so N8N /
 * Canva / WhatsApp always receive copy.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateListing } from "@/ai/generateListing";
import { UnitSchema } from "@/domain/inventory/unit";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  unit: UnitSchema,
  language: z.enum(["en", "ar"]).default("en"),
});

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json(
        { error: "Body must be { unit: Unit, language?: 'en'|'ar' }", issues: body.error.issues },
        { status: 400 },
      );
    }
    const result = await generateListing(body.data.unit, body.data.language);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
