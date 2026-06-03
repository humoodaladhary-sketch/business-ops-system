import { NextRequest, NextResponse } from "next/server";
import { syncFromSheets } from "@/application/use-cases/syncFromSheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true; // Vercel scheduled job
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token || token === "change-me") return true;
  return req.headers.get("x-internal-token") === token || req.nextUrl.searchParams.get("token") === token;
}

// Pull the agent Google Sheets into the database. Trigger on a schedule
// (n8n / cron-job.org / Vercel cron) or manually with ?token=...
async function run(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL not set — configure the database first." }, { status: 400 });
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 not set — add the service account." }, { status: 400 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const summary = await syncFromSheets();
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
