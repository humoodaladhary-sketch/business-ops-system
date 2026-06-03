import { NextResponse } from "next/server";
import { sweepExpired, getState } from "@/app/_data/assignment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron target (Supabase scheduled function / Vercel cron): re-routes any basket
// whose 10-minute window lapsed. Safe to call frequently.
export async function GET() {
  sweepExpired();
  return NextResponse.json({ ok: true, assignments: getState() });
}

export const POST = GET;
