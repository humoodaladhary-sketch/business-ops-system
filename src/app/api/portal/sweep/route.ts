import { NextRequest, NextResponse } from "next/server";
import { sweepExpired, getState } from "@/app/_data/assignment";
import { requireInternalToken, tokenFromRequest } from "@/infrastructure/auth/internalToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron target (Supabase scheduled function / Vercel cron): re-routes any basket
// whose 10-minute window lapsed. Safe to call frequently.
//
// There is no user session on a cron call, so this is gated by
// INTERNAL_API_TOKEN and fails closed. Left open, it let anyone force lead
// reassignment on demand and read back the resulting state.
async function run(req: NextRequest) {
  const auth = requireInternalToken(tokenFromRequest(req));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  sweepExpired();
  return NextResponse.json({ ok: true, assignments: getState() });
}

export const GET = run;
export const POST = run;
