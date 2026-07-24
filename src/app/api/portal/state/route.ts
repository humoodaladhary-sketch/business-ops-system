import { NextResponse } from "next/server";
import { getState, CLAIM_WINDOW_MS } from "@/app/_data/assignment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ now: Date.now(), claimWindowMs: CLAIM_WINDOW_MS, assignments: getState() });
}
