import { NextResponse } from "next/server";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";
import { isSupabaseConfigured } from "@/infrastructure/auth/session";
import { adminConfigured } from "@/infrastructure/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public go-live status. Returns only non-sensitive booleans/counts — never
// secrets or connection strings — so you can verify the deployment at a glance:
//   /api/health
export async function GET() {
  const out: Record<string, unknown> = {
    ok: true,
    time: new Date().toISOString(),
    auth: {
      provider: isSupabaseConfigured() ? "supabase" : "preview",
      adminApiConfigured: adminConfigured(),
      superAdminSeedConfigured: Boolean(process.env.SUPER_ADMIN_EMAIL && process.env.SUPER_ADMIN_PASSWORD),
    },
    database: { configured: hasDatabase, reachable: false as boolean, seeded: false as boolean },
  };

  if (hasDatabase) {
    try {
      const [agents, ladder, floors] = await Promise.all([
        prisma.agent.count(),
        prisma.commissionLadder.count(),
        prisma.leadSourceFloor.count(),
      ]);
      out.database = {
        configured: true,
        reachable: true,
        seeded: agents > 0 && ladder > 0,
        counts: { agents, ladderTiers: ladder, sourceFloors: floors },
      };
    } catch (e) {
      out.database = { configured: true, reachable: false, error: (e as Error).message.slice(0, 140) };
      out.ok = false;
    }
  }

  // A short, ordered checklist of what's left before the system is live.
  const db = out.database as { reachable?: boolean; seeded?: boolean };
  out.nextSteps = [
    db.reachable ? "✓ Database connected" : "Run init_schema.sql in the Supabase SQL editor + set the connection env vars",
    db.seeded ? "✓ Seeded" : "Open /setup once (creates your Super Admin login + seeds the config)",
    (out.auth as { provider?: string }).provider === "supabase" ? "✓ Real auth on" : "Add the Supabase keys (auth still in preview mode)",
  ];

  return NextResponse.json(out, { status: out.ok ? 200 : 503 });
}
