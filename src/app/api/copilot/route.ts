import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runCopilot, type ChatMsg } from "@/lib/copilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  department: z.string(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.any() })).max(40),
});

// The copilot runner picks the best available backend (direct Anthropic with a
// live DB tool-loop, n8n webhook, or the edge function) — see src/lib/copilot.ts.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    const out = await runCopilot(parsed.data.department, parsed.data.messages as ChatMsg[]);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: "copilot_failed", detail: (e as Error).message.slice(0, 200) });
  }
}
