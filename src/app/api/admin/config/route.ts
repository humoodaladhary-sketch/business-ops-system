import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/infrastructure/auth/session";
import { hasDatabase, prisma } from "@/infrastructure/prisma/client";
import { setSetting } from "@/infrastructure/prisma/settings";
import {
  getConfig, setLadder, setFloors, setDevRates, setTarget,
} from "@/app/_data/runtimeConfig";
import { currentPeriod } from "@/infrastructure/prisma/periods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Tier = z.object({
  tierName: z.string().min(1),
  minPctOfTarget: z.number().min(0),
  maxPctOfTarget: z.number().min(0).nullable(),
  agentSplitRate: z.number().min(0).max(1),
  sortOrder: z.number().int(),
});
const Floor = z.object({ source: z.enum(["ALWALAA_SOURCED", "AGENT_NETWORK"]), floorSplitRate: z.number().min(0).max(1) });
const DevRate = z.object({ developer: z.string().min(1), ratePct: z.number().min(0).max(15) });
const CopilotZ = z.object({
  displayName: z.string().min(1),
  tone: z.string().min(1),
  directness: z.enum(["gentle", "balanced", "blunt"]),
  formality: z.enum(["casual", "professional", "formal"]),
  verbosity: z.enum(["terse", "balanced", "detailed"]),
  language: z.literal("en"),
  customInstructions: z.string(),
  signaturePrinciples: z.array(z.string()),
});

const Body = z.discriminatedUnion("section", [
  z.object({ section: z.literal("ladder"), ladder: z.array(Tier).min(1) }),
  z.object({ section: z.literal("floors"), floors: z.array(Floor).min(1) }),
  z.object({ section: z.literal("devRates"), devRates: z.array(DevRate).min(1) }),
  z.object({ section: z.literal("target"), agentId: z.string().min(1), amount: z.number().min(0) }),
  z.object({ section: z.literal("copilot"), copilot: CopilotZ }),
]);

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== "ADMIN") return null;
  return s;
}

export async function GET() {
  const s = await requireAdmin();
  if (!s) return NextResponse.json({ error: "Super Admin only." }, { status: 403 });
  return NextResponse.json({ ok: true, config: getConfig(), persisted: hasDatabase });
}

export async function PUT(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return NextResponse.json({ error: "Super Admin only." }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const b = parsed.data;

  if (b.section === "copilot") {
    await setSetting("copilot", b.copilot);
    return NextResponse.json({ ok: true, persisted: hasDatabase });
  }

  // Apply immediately (drives the running engine), then persist when DB exists.
  if (b.section === "ladder") setLadder(b.ladder);
  if (b.section === "floors") setFloors(b.floors);
  if (b.section === "devRates") setDevRates(b.devRates);
  if (b.section === "target") setTarget(b.agentId, b.amount);

  if (hasDatabase) {
    try {
      if (b.section === "ladder") {
        for (const t of b.ladder) {
          await prisma.commissionLadder.upsert({ where: { tierName: t.tierName }, update: t, create: t });
        }
      }
      if (b.section === "floors") {
        for (const f of b.floors) {
          await prisma.leadSourceFloor.upsert({ where: { source: f.source }, update: f, create: f });
        }
      }
      if (b.section === "devRates") {
        for (const r of b.devRates) {
          const key = r.developer.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const dev = await prisma.developer.upsert({
            where: { canonicalKey: key },
            update: {},
            create: { name: r.developer, canonicalKey: key },
          });
          await prisma.developerCommissionRule.upsert({
            where: { developerId_minQuarterlyVolume: { developerId: dev.id, minQuarterlyVolume: 0 } },
            update: { rate: r.ratePct / 100 },
            create: { developerId: dev.id, minQuarterlyVolume: 0, rate: r.ratePct / 100, tierName: "Flat" },
          });
        }
      }
      if (b.section === "target") {
        await prisma.target.upsert({
          where: { agentId_period: { agentId: b.agentId, period: currentPeriod() } },
          update: { targetAmount: b.amount, source: "CUSTOM" },
          create: { agentId: b.agentId, period: currentPeriod(), targetAmount: b.amount, source: "CUSTOM" },
        });
      }
      await prisma.auditLog.create({
        data: { actorId: s.userId, actorRole: s.role, action: `settings.${b.section}.updated`, entity: "Setting", after: b as never },
      });
    } catch {
      // In-memory config is applied; DB persistence will retry on next save.
    }
  }

  return NextResponse.json({ ok: true, config: getConfig(), persisted: hasDatabase });
}
