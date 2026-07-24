import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token || token === "change-me") return true;
  return req.headers.get("x-internal-token") === token;
}

/**
 * Outbound alert hook (Phase 5). Accepts an at-risk / milestone event and fans
 * it out to ALERT_WEBHOOK_URL (e.g. an n8n flow that messages WhatsApp via
 * Respond.io). No-ops cleanly when the URL is unset.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.agentId !== "string") {
    return NextResponse.json({ error: "expected { agentId, period, reason }" }, { status: 400 });
  }

  const url = process.env.ALERT_WEBHOOK_URL;
  let forwarded = false;
  if (url) {
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "AT_RISK", ...body, firedAt: new Date().toISOString() }),
      });
      forwarded = true;
    } catch {
      forwarded = false;
    }
  }

  return NextResponse.json({ ok: true, forwarded });
}
