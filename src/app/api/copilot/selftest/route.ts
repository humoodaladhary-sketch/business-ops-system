import { NextRequest, NextResponse } from "next/server";
import { runCopilot, type ChatMsg } from "@/lib/copilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// TEMPORARY diagnostic endpoint. Token-gated. Runs the real copilot server-side
// so it can be exercised with a GET (the chat UI uses POST, which the dev sandbox
// can't reach). Remove once the copilot is verified.
const TOKEN = "6e9342e74d7a4eb39720441a504ef6f33ba2c091638d3c85";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dept = req.nextUrl.searchParams.get("dept") || "finance";
  const q = req.nextUrl.searchParams.get("q") || "Give me the finance summary.";
  const env = {
    has_anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY),
    has_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    model: process.env.ANTHROPIC_MODEL || "(default in code)",
  };
  const started = Date.now();
  let result: unknown;
  try {
    result = await runCopilot(dept, [{ role: "user", content: q }] as ChatMsg[]);
  } catch (e) {
    result = { threw: (e as Error).message, stack: (e as Error).stack?.slice(0, 600) };
  }
  return NextResponse.json({ env, dept, q, ms: Date.now() - started, result });
}
