import { NextResponse } from "next/server";
import { getState, CLAIM_WINDOW_MS } from "@/app/_data/assignment";
import { getSession } from "@/infrastructure/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assignment state carries lead identities, so it is session-gated. It was
// previously served to anyone who requested it.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  return NextResponse.json({ now: Date.now(), claimWindowMs: CLAIM_WINDOW_MS, assignments: getState() });
}
