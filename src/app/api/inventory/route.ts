import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/infrastructure/auth/session";
import { canManageInventory } from "@/domain";
import { getUnits, upsertUnit } from "@/app/_data/runtimeConfig";
import { hasDatabase, prisma } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Unit = z.object({
  id: z.string().optional(),
  project: z.string().min(1),
  developer: z.string().min(1),
  unitType: z.string().min(1),
  bedrooms: z.number().int().min(0).max(12).nullable(),
  priceOMR: z.number().min(1),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD"]).default("AVAILABLE"),
  published: z.boolean().default(false),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({ ok: true, units: getUnits() });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !canManageInventory(s.role === "ADMIN" ? "ADMIN" : "ADVISOR")) {
    return NextResponse.json({ error: "Only admins can manage inventory." }, { status: 403 });
  }
  const parsed = Unit.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid unit." }, { status: 400 });
  }
  const u = parsed.data;
  const unit = { ...u, id: u.id ?? `u-${Date.now().toString(36)}`, bedrooms: u.bedrooms ?? null };
  upsertUnit(unit);

  if (hasDatabase) {
    try {
      await prisma.unit.upsert({
        where: { id: unit.id },
        update: { unitType: unit.unitType, bedrooms: unit.bedrooms, priceOMR: unit.priceOMR, status: unit.status, published: unit.published },
        create: { id: unit.id, market: "OFF_PLAN", unitType: unit.unitType, bedrooms: unit.bedrooms, priceOMR: unit.priceOMR, status: unit.status, published: unit.published, attributes: { project: unit.project, developer: unit.developer } },
      });
      await prisma.auditLog.create({
        data: { actorId: s.userId, actorRole: s.role, action: "unit.upserted", entity: "Unit", entityId: unit.id, after: unit as never },
      });
    } catch {
      /* in-memory copy already applied */
    }
  }
  return NextResponse.json({ ok: true, units: getUnits(), persisted: hasDatabase });
}
