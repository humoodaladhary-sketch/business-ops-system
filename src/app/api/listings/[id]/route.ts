/** PATCH /api/listings/[id] — save human edits to a listing's title/body. */

import { NextRequest, NextResponse } from "next/server";
import { updateListingBody } from "@/lib/supabase/db";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { title, body } = (await req.json()) as { title?: string; body: string };
    if (typeof body !== "string") {
      return NextResponse.json({ error: "Body required" }, { status: 400 });
    }
    await updateListingBody(id, body, title);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
