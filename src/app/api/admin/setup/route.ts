import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasDatabase, prisma } from "@/infrastructure/prisma/client";
import { adminConfigured } from "@/infrastructure/auth/admin";
import { seedSystem, createSuperAdmin } from "../bootstrap/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  token: z.string().min(1),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  designation: z.string().max(60).optional(),
});

/**
 * One-time guided setup (driven by the /setup page). Gated by INTERNAL_API_TOKEN.
 * Creates the Super Admin login in Supabase auth and seeds the commission
 * config. Idempotent — safe to submit again.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected || expected === "change-me") {
    return NextResponse.json({ error: "INTERNAL_API_TOKEN is not set in Vercel — add it under Settings → Environment Variables, redeploy, then retry." }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid form." }, { status: 400 });
  }
  const b = parsed.data;
  if (b.token !== expected) {
    return NextResponse.json({ error: "Setup token does not match INTERNAL_API_TOKEN." }, { status: 401 });
  }

  if (!adminConfigured()) {
    return NextResponse.json({
      error: "Supabase auth is not configured. In Vercel set AUTH_PROVIDER=supabase, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, then redeploy.",
    }, { status: 503 });
  }

  const account = await createSuperAdmin({
    email: b.email.trim().toLowerCase(),
    password: b.password,
    name: b.name.trim(),
    designation: b.designation?.trim() || "CEO",
  });
  if (!account.ok) return NextResponse.json({ error: `Account: ${account.status}` }, { status: 500 });

  let seeded: Record<string, number> | null = null;
  let seedError: string | null = null;
  if (hasDatabase) {
    try {
      seeded = await seedSystem();
      await prisma.auditLog.create({ data: { action: "system.setup", entity: "System", after: { account: account.status, ...seeded } as never } });
    } catch (e) {
      seedError = (e as Error).message.slice(0, 200);
    }
  } else {
    seedError = "Database not connected — account created, but config could not be seeded yet.";
  }

  return NextResponse.json({ ok: true, account: account.status, seeded, seedError });
}
