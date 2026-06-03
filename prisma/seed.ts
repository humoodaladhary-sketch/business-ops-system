// Idempotent seed. Encodes all configuration the engine depends on so that
// adding an agent / developer / tier / target is data, not code.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- Commission ladder (25/35/40/50, fractions) -----------------------------
const LADDER = [
  { tierName: "Recovery", minPctOfTarget: 0.0, maxPctOfTarget: 0.5, agentSplitRate: 0.25, sortOrder: 0 },
  { tierName: "On Track", minPctOfTarget: 0.5, maxPctOfTarget: 0.8, agentSplitRate: 0.35, sortOrder: 1 },
  { tierName: "Strong", minPctOfTarget: 0.8, maxPctOfTarget: 1.0, agentSplitRate: 0.4, sortOrder: 2 },
  { tierName: "Top", minPctOfTarget: 1.0, maxPctOfTarget: null, agentSplitRate: 0.5, sortOrder: 3 },
];

// --- Developers + flat (tier-ready) rate, with source-name aliases ----------
const DEVELOPERS = [
  { name: "Ahly Sabbour", key: "ahly_sabbour", rate: 0.035, aliases: ["alahly sabbour", "ahly sabbour", "ahli sabbur", "ahly subbour", "ahli sabbour"] },
  { name: "Sarooj Development", key: "sarooj", rate: 0.04, aliases: ["sarooj development", "sarooj", "sarooj oasis"] },
  { name: "Muriya", key: "muriya", rate: 0.03, aliases: ["muriya", "muriya development"] },
  { name: "Al Abrar", key: "al_abrar", rate: 0.03, aliases: ["alabrar", "al abrar", "alabrar real estate", "alabrar real estate "] },
  { name: "Adante Realty", key: "adante", rate: 0.03, aliases: ["adante", "adante realty"] },
  { name: "Omran Group", key: "omran", rate: 0.03, aliases: ["omran", "omran group"] },
  { name: "Dar Global", key: "dar_global", rate: 0.03, aliases: ["dar global"] },
];

// --- Projects (priority rank, signed status), with aliases ------------------
const PROJECTS = [
  { name: "Wadi Zaha", dev: "ahly_sabbour", rank: 1, signed: true, location: "Sultan Haitham City", aliases: ["wadi zaha", "wadi zaha & yenaier"] },
  { name: "Hay Al Wafaa", dev: "al_abrar", rank: 2, signed: true, location: "Sultan Haitham City", aliases: ["hay alwafa", "hay alwafaa", "hay al wafaa"] },
  { name: "Yenaire", dev: "adante", rank: 3, signed: true, location: "Sultan Haitham City", aliases: ["yenair", "yenaier", "yenaire"] },
  { name: "Sarooj Oasis", dev: "sarooj", rank: 4, signed: true, location: "Muscat", aliases: ["sarooj oasis", "sarooj osis"] },
  { name: "Olive Farms", dev: "muriya", rank: 5, signed: true, location: "Jebel Sifah", aliases: ["olive farms", "olive farms - raya jebel sifah", "raya jebel sifah"] },
];

// --- Agents (roster + targets). Sheet-only names flagged role-to-confirm. ----
const NOW = new Date();
const RAMP_END = new Date(NOW.getTime() + 90 * 24 * 3600 * 1000);
// Stable ids align seed, the Sheets sync writer, and the UI data layer.
const AGENTS = [
  { id: "shatha", name: "Shatha Al Manthari", role: "SENIOR", segment: "DIASPORA", target: 350000 },
  { id: "alex", name: "Alex Showran", role: "ADVISOR", segment: "RESIDENT", target: 250000 },
  { id: "pasha", name: "Pasha", role: "ADVISOR", segment: "RESIDENT", target: 250000 },
  { id: "wesam", name: "Wesam Zeno", role: "ADVISOR", segment: "RESIDENT", target: 250000 },
  { id: "khalid", name: "Khalid", role: "NEW", segment: "RESIDENT", target: 120000, rampEndDate: RAMP_END },
  { id: "tariq", name: "Tariq", role: "TRAINEE", segment: "NA", target: null, exempt: true },
  { id: "abeer", name: "Abeer Al Wardi", role: "MARKETING", segment: "NA", target: null },
  { id: "ishaq", name: "Ishaq", role: "FINANCE", segment: "NA", target: null },
  { id: "chris", name: "Chris", role: "LISTINGS", segment: "NA", target: null },
  { id: "humood", name: "Humood Al Adhary", role: "CEO", segment: "NA", target: null },
  // Former employee — kept for records only.
  { id: "yousef", name: "Yousef", role: "ADVISOR", segment: "NA", target: null, inactive: true },
  { id: "safaa", name: "Safaa", role: "ADVISOR", segment: "NA", target: 250000 },
  { id: "sulaiman", name: "Sulaiman", role: "FINANCE", segment: "NA", target: null },
  { id: "menessa", name: "Menessa", role: "ADVISOR", segment: "NA", target: 250000 },
] as const;

const PERIODS = ["2026-03", "2026-04", "2026-05", "2026-06"];

// --- StageMapping (global) from the Phase 0 stage-label inventory ------------
const STAGE_MAP: Array<[string, string]> = [
  ["new", "NEW"],
  ["contacted", "QUALIFIED"],
  ["qualification meeting", "ENGAGED"],
  ["in progress", "NEGOTIATION"],
  ["pending", "RESERVATION"],
  ["spa pending", "RESERVATION"],
  ["reserved", "RESERVATION"],
  ["closed", "CLOSED_WON"],
  ["sold", "CLOSED_WON"],
  ["lost", "CLOSED_LOST"],
];

async function main() {
  // Ladder
  for (const t of LADDER) {
    await prisma.commissionLadder.upsert({ where: { tierName: t.tierName }, update: t, create: t });
  }

  // Lead-source floors (Decision 1)
  for (const f of [
    { source: "AGENT_NETWORK" as const, floorSplitRate: 0.5, note: "Own/referral leads floor at 50%" },
    { source: "ALWALAA_SOURCED" as const, floorSplitRate: 0, note: "Ladder only (no floor)" },
  ]) {
    await prisma.leadSourceFloor.upsert({ where: { source: f.source }, update: f, create: f });
  }

  // Developers + rules + aliases
  const devIdByKey = new Map<string, string>();
  for (const dvp of DEVELOPERS) {
    const dev = await prisma.developer.upsert({
      where: { canonicalKey: dvp.key },
      update: { name: dvp.name },
      create: { name: dvp.name, canonicalKey: dvp.key },
    });
    devIdByKey.set(dvp.key, dev.id);
    await prisma.developerCommissionRule.upsert({
      where: { developerId_minQuarterlyVolume: { developerId: dev.id, minQuarterlyVolume: 0 } },
      update: { rate: dvp.rate },
      create: { developerId: dev.id, minQuarterlyVolume: 0, maxQuarterlyVolume: null, rate: dvp.rate, tierName: "Flat" },
    });
    for (const alias of dvp.aliases) {
      await prisma.developerAlias.upsert({ where: { alias }, update: { developerId: dev.id }, create: { alias, developerId: dev.id } });
    }
  }

  // Projects + aliases
  for (const p of PROJECTS) {
    const developerId = devIdByKey.get(p.dev)!;
    const proj = await prisma.project.upsert({
      where: { developerId_name: { developerId, name: p.name } },
      update: { priorityRank: p.rank, signed: p.signed, location: p.location },
      create: { developerId, name: p.name, priorityRank: p.rank, signed: p.signed, location: p.location },
    });
    for (const alias of p.aliases) {
      await prisma.projectAlias.upsert({ where: { alias }, update: { projectId: proj.id }, create: { alias, projectId: proj.id } });
    }
  }

  // Agents + targets
  for (const a of AGENTS) {
    const status = "inactive" in a && a.inactive ? "INACTIVE" : a.role === "TRAINEE" ? "PROBATION" : "ACTIVE";
    const agent = await prisma.agent.upsert({
      where: { id: a.id },
      update: { name: a.name, role: a.role as any, segment: a.segment as any, status },
      create: {
        id: a.id,
        name: a.name,
        email: emailFor(a.name),
        role: a.role as any,
        segment: a.segment as any,
        status,
        exemptFromAtRisk: "exempt" in a ? Boolean(a.exempt) : false,
        rampEndDate: "rampEndDate" in a ? a.rampEndDate : null,
      },
    });
    if (a.target) {
      for (const period of PERIODS) {
        await prisma.target.upsert({
          where: { agentId_period: { agentId: agent.id, period } },
          update: { targetAmount: a.target },
          create: { agentId: agent.id, period, targetAmount: a.target, source: "ROLE_DEFAULT" },
        });
      }
    }
  }

  // Stage mappings (global). agentId is null here; Postgres treats NULLs as
  // distinct in the compound unique, so find-then-write to stay idempotent.
  for (const [sourceLabel, stage] of STAGE_MAP) {
    const existing = await prisma.stageMapping.findFirst({ where: { sourceLabel, agentId: null } });
    if (existing) {
      await prisma.stageMapping.update({ where: { id: existing.id }, data: { canonicalStage: stage as any } });
    } else {
      await prisma.stageMapping.create({ data: { sourceLabel, canonicalStage: stage as any } });
    }
  }

  console.log("Seed complete: ladder, floors, developers, projects, agents, targets, stage maps.");
}

function emailFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "") + "@alwalaaoman.com";
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
