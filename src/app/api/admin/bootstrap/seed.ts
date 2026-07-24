import { prisma, hasDatabase } from "@/infrastructure/prisma/client";
import { getLadder, getFloors, getDevRates } from "@/app/_data/runtimeConfig";
import { AGENTS } from "@/app/_data/dataset";
import { supabaseAdmin, adminConfigured } from "@/infrastructure/auth/admin";

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

/** Seed all commission config + agents + targets. Idempotent — safe to re-run. */
export async function seedSystem(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};

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

  return out;
}

/**
 * First-run convenience: the very first person to sign in becomes the Super
 * Admin, with whatever password they type. SAFE because it only runs while NO
 * admin exists yet — once one does, this path is closed (not a backdoor). Also
 * repairs a stale/half-created account, and seeds the config on success, so a
 * fresh deployment goes from "Invalid email or password" to a working app in one
 * sign-in. Returns whether the claim succeeded.
 */
export async function claimFirstAdmin(
  email: string,
  password: string,
  name?: string,
): Promise<{ claimed: boolean; reason?: string }> {
  if (!adminConfigured()) return { claimed: false, reason: "supabase admin keys not configured" };
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return { claimed: false, reason: error.message };

  const users = data.users ?? [];
  const adminExists = users.some((u) => (u.app_metadata as { role?: string } | null)?.role === "ADMIN");
  if (adminExists) return { claimed: false, reason: "an admin already exists" };

  const e = email.trim().toLowerCase();
  const displayName = name?.trim() || e.split("@")[0].replace(/^\w/, (c) => c.toUpperCase());
  const existing = users.find((u) => (u.email ?? "").toLowerCase() === e);

  if (existing) {
    const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...(existing.app_metadata ?? {}), role: "ADMIN" },
      user_metadata: { ...(existing.user_metadata ?? {}), name: (existing.user_metadata?.name as string) ?? displayName, designation: "CEO" },
    });
    if (upErr) return { claimed: false, reason: upErr.message };
  } else {
    const { error: cErr } = await admin.auth.admin.createUser({
      email: e,
      password,
      email_confirm: true,
      user_metadata: { name: displayName, designation: "CEO" },
      app_metadata: { role: "ADMIN" },
    });
    if (cErr) return { claimed: false, reason: cErr.message };
  }

  // Seed the commission config so the dashboard isn't empty (best-effort).
  try {
    if (hasDatabase) await seedSystem();
  } catch {
    /* idempotent — a later /setup or bootstrap will finish it */
  }
  return { claimed: true };
}

/**
 * Create (or confirm) a Super Admin login in Supabase auth. Idempotent:
 * "already registered" counts as success so re-running setup never locks out.
 */
export async function createSuperAdmin(opts: {
  email: string;
  password: string;
  name: string;
  designation?: string;
}): Promise<{ ok: boolean; status: string }> {
  if (!adminConfigured()) {
    return { ok: false, status: "Supabase admin keys not configured (need AUTH_PROVIDER=supabase, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)." };
  }
  try {
    const { error } = await supabaseAdmin().auth.admin.createUser({
      email: opts.email,
      password: opts.password,
      email_confirm: true,
      user_metadata: { name: opts.name, designation: opts.designation ?? "CEO" },
      app_metadata: { role: "ADMIN" },
    });
    if (!error) return { ok: true, status: "created" };
    if (/already|exists|registered/i.test(error.message)) return { ok: true, status: "already exists — just sign in" };
    return { ok: false, status: error.message };
  } catch (e) {
    return { ok: false, status: (e as Error).message };
  }
}
