import { NextRequest, NextResponse } from "next/server";
import { assign, claim, pass, updateStage, getState } from "@/app/_data/assignment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string" || typeof body.leadId !== "string") {
    return NextResponse.json({ error: "expected { action, leadId, ... }" }, { status: 400 });
  }
  switch (body.action) {
    case "assign":
      if (typeof body.agentId !== "string") return NextResponse.json({ error: "agentId required" }, { status: 400 });
      assign(body.leadId, body.agentId);
      break;
    case "claim":
      if (typeof body.agentId !== "string") return NextResponse.json({ error: "agentId required" }, { status: 400 });
      claim(body.leadId, body.agentId);
      break;
    case "pass":
      pass(body.leadId);
      break;
    case "stage":
      if (typeof body.stage !== "string") return NextResponse.json({ error: "stage required" }, { status: 400 });
      updateStage(body.leadId, body.stage);
      break;
    default:
      return NextResponse.json({ error: `unknown action ${body.action}` }, { status: 400 });
  }
  return NextResponse.json({ now: Date.now(), assignments: getState() });
}
