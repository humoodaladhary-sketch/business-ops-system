import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/infrastructure/auth/session";
import { hasDatabase, prisma } from "@/infrastructure/prisma/client";
import { getLadder, getFloors, getDevRates } from "@/app/_data/runtimeConfig";
import { AGENTS } from "@/app/_data/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PROJECTS: Array<[string, string, number]> = [
  ["Wadi Zaha", "Ahly Sabbour", 1],
  ["Hay Al Wafaa", "Al Abrar", 2],
  ["Yenaire", "Adante Realty", 3],
  ["Sarooj Oasis", "Sarooj Development", 4],
  ["Olive Farms", "Muriya", 5],
];

const STAGE_MAP: Array<[string, string]> = [
  ["new", "NEW"], ["contacted", "QUALIFIED"], ["qualification meeting", "ENGAGED"],
  ["in progress", "NEGOTIATION"], ["pending", "RESERVATION"], ["spa pending", "RESERVATION"],
  ["reserved", "RESERVATION"], ["closing stage", "NEGOTIATION"], ["closed", "CLOSED_WON"],
  ["sold", "CLOSED_WON"], ["lost", "CLOSED_LOST"],
];

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_");

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
 * Idempotent — safe to re-run.
 */
async function run(req: NextRequest) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "DATABASE_URL is not set — add the Supabase env first (docs/GO-LIVE.md)." }, { status: 400 });
  }
  if (!(await authorized(req))) return NextResponse.json({ error: "Super Admin or token required." }, { status: 401 });

  const out: Record<string, number> = {};
  try {
    for (const t of getLadder()) {
      await prisma.commissionLadder.upsert({ where: { tierName: t.tierName }, update: t, create: t });
    }
    out.ladderTiers = getLadder().length;

    for (const f of getFloors()) {
      await prisma.leadSourceFloor.upsert({ where: { source: f.source }, update: f, create: f });
    }
    out.floors = getFloors().length;

    const devId = new Map<string, string>();
    for (const r of getDevRates()) {
      const dev = await prisma.developer.upsert({
        where: { canonicalKey: key(r.developer) },
        update: { name: r.developer },
        create: { name: r.developer, canonicalKey: key(r.developer) },
      });
      devId.set(r.developer, dev.id);
      await prisma.developerCommissionRule.upsert({
        where: { developerId_minQuarterlyVolume: { developerId: dev.id, minQuarterlyVolume: 0 } },
        update: { rate: r.ratePct / 100 },
        create: { developerId: dev.id, minQuarterlyVolume: 0, rate: r.ratePct / 100, tierName: "Flat" },
      });
    }
    out.developers = devId.size;

    for (const [name, dev, rank] of PROJECTS) {
      const developerId = devId.get(dev);
      if (!developerId) continue;
      await prisma.project.upsert({
        where: { developerId_name: { developerId, name } },
        update: { priorityRank: rank, signed: true },
        create: { developerId, name, priorityRank: rank, signed: true },
      });
    }
    out.projects = PROJECTS.length;

    const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
    let targets = 0;
    for (const a of AGENTS) {
      await prisma.agent.upsert({
        where: { id: a.id },
        update: { name: a.name, status: a.status === "FORMER" ? "INACTIVE" : "ACTIVE" },
        create: {
          id: a.id,
          name: a.name,
          email: `${a.id}@alwalaaoman.com`,
          role: (["SENIOR", "ADVISOR", "NEW", "TRAINEE", "MARKETING", "FINANCE", "CEO"].includes(a.role) ? a.role : "ADVISOR") as never,
          segment: a.segment as never,
          status: a.status === "FORMER" ? "INACTIVE" : a.role === "TRAINEE" ? "PROBATION" : "ACTIVE",
          exemptFromAtRisk: a.exempt ?? false,
          rampEndDate: a.rampEndDate ? new Date(a.rampEndDate) : null,
        },
      });
      if (a.target > 0 && a.status !== "FORMER") {
        await prisma.target.upsert({
          where: { agentId_period: { agentId: a.id, period } },
          update: { targetAmount: a.target },
          create: { agentId: a.id, period, targetAmount: a.target, source: "ROLE_DEFAULT" },
        });
        targets++;
      }
    }
    out.agents = AGENTS.length;
    out.targets = targets;

    for (const [sourceLabel, stage] of STAGE_MAP) {
      const existing = await prisma.stageMapping.findFirst({ where: { sourceLabel, agentId: null } });
      if (existing) await prisma.stageMapping.update({ where: { id: existing.id }, data: { canonicalStage: stage as never } });
      else await prisma.stageMapping.create({ data: { sourceLabel, canonicalStage: stage as never } });
    }
    out.stageMappings = STAGE_MAP.length;

    await prisma.auditLog.create({ data: { action: "system.bootstrap", entity: "System", after: out as never } });
    return NextResponse.json({ ok: true, seeded: out, next: "Run /api/sync to pull the Google Sheets, and create logins under Settings → User Access." });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, seededSoFar: out }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
