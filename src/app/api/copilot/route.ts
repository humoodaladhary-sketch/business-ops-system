import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runCopilot, type ChatMsg } from "@/lib/copilot";
import { getSession } from "@/infrastructure/auth/session";

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
  // The copilot spends the Anthropic key and its tools read live business data,
  // so the caller must hold a session. This route previously had no check.
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    const out = await runCopilot(parsed.data.department, parsed.data.messages as ChatMsg[]);
    // Lightweight observability: outcome only (no message content).
    const o = out as { ok?: boolean; reply?: string; setup?: boolean; error?: string; status?: number };
    const outcome = o.ok ? `ok(${(o.reply ?? "").length}c)` : o.setup ? "setup" : `error:${o.error ?? "?"}${o.status ? "/" + o.status : ""}`;
    console.log(`[copilot] dept=${parsed.data.department} svc=${Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} -> ${outcome}`);
    return NextResponse.json(out);
  } catch (e) {
    console.log(`[copilot] dept=${parsed.data.department} -> threw:${(e as Error).message.slice(0, 120)}`);
    return NextResponse.json({ error: "copilot_failed", detail: (e as Error).message.slice(0, 200) });
  }
}
