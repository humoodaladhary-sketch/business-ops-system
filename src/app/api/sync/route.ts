import { NextRequest, NextResponse } from "next/server";
import { syncFromSheets } from "@/application/use-cases/syncFromSheets";
import { requireInternalToken, tokenFromRequest } from "@/infrastructure/auth/internalToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Pull the agent Google Sheets into the database. Trigger on a schedule
// (n8n / cron-job.org / Vercel cron) or manually with the token.
//
// Authorization is by INTERNAL_API_TOKEN only, and it fails closed. The previous
// check trusted an `x-vercel-cron` header, which any client can set, and treated
// a missing token as permission to run — between them, an open door to a job
// that writes to the database. Vercel Cron authenticates with
// `Authorization: Bearer $CRON_SECRET`, which `tokenFromRequest` reads, so set
// INTERNAL_API_TOKEN and CRON_SECRET to the same value.
async function run(req: NextRequest) {
  const auth = requireInternalToken(tokenFromRequest(req));
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set — configure the database first." }, { status: 400 });
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 not set — add the service account." }, { status: 400 });
  }

  try {
    const summary = await syncFromSheets();
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
