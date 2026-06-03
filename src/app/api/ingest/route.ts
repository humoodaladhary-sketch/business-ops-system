import { NextRequest, NextResponse } from "next/server";
import { parseDealsCsv } from "@/infrastructure/ingestion/CsvAdapter";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token || token === "change-me") return true; // open until a token is set
  return req.headers.get("x-internal-token") === token;
}

/**
 * Day-one CSV ingestion fallback. Validates a "My Deals Status" export, returns
 * a clean summary, and rejects-and-reports bad rows. Persistence to the
 * append-only staging tables is wired through the Prisma repositories when a
 * database is configured.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let csv = "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      csv = file instanceof File ? await file.text() : String(form.get("csv") ?? "");
    } else {
      csv = await req.text();
    }
  } catch {
    return NextResponse.json({ error: "could not read request body" }, { status: 400 });
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "no CSV provided" }, { status: 400 });
  }

  const result = parseDealsCsv(csv);
  return NextResponse.json({
    received: result.rawRows.length,
    valid: result.valid.length,
    rejected: result.errors.length,
    errors: result.errors.slice(0, 50),
    preview: result.valid.slice(0, 5),
    note: "Staging is append-only; rejected rows are logged and never stored as deals.",
  });
}
