import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/infrastructure/auth/session";
import { hasDatabase, prisma } from "@/infrastructure/prisma/client";
import { seedSystem, createSuperAdmin } from "./seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function authorized(req: NextRequest): Promise<boolean> {
  const s = await getSession();
  if (s?.role === "ADMIN") return true;
  const token = process.env.INTERNAL_API_TOKEN;
  return Boolean(token && token !== "change-me" &&
    (req.headers.get("x-internal-token") === token || req.nextUrl.searchParams.get("token") === token));
}

/**
 * One-click database seed. After creating the Supabase project, running the
 * schema SQL (supabase/migrations) and setting the env vars, open this route
 * once: it seeds ladder/floors/developers/projects/agents/targets/stage-maps.
 * Idempotent — safe to re-run. (Prefer the friendlier /setup page.)
 */
async function run(req: NextRequest) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "Database connection is not set — link Supabase in Vercel or set DATABASE_URL (docs/GO-LIVE.md)." }, { status: 400 });
  }
  if (!(await authorized(req))) return NextResponse.json({ error: "Super Admin or token required." }, { status: 401 });

  let out: Record<string, number> = {};
  try {
    out = await seedSystem();

    // Optional env-driven first login (the /setup page is the friendlier path).
    let superAdmin: string | null = null;
    if (process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD) {
      const r = await createSuperAdmin({
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
        name: process.env.SUPER_ADMIN_NAME ?? "Super Admin",
      });
      superAdmin = r.status;
    }

    await prisma.auditLog.create({ data: { action: "system.bootstrap", entity: "System", after: out as never } });
    return NextResponse.json({
      ok: true,
      seeded: out,
      superAdmin,
      next: "Sign in at /login, then run /api/sync and add team logins under Settings → User Access.",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, seededSoFar: out }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
