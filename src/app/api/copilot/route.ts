import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deptApi } from "@/lib/deptApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  department: z.string(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.any() })).max(40),
});

// Thin proxy to the Supabase dept-api edge function (which holds the DB service
// role + Anthropic key). Keeps all secrets out of the app.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    const out = await deptApi({ action: "chat", department: parsed.data.department, messages: parsed.data.messages });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: "edge_unreachable", detail: (e as Error).message.slice(0, 200) });
  }
}
