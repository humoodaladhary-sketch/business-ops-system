import type { PrismaClient } from "@prisma/client";
import { applyRate } from "@/domain";
import { canonicalizeDeveloper, canonicalizeProject } from "../ingestion/canonicalize";
import type { DealInput } from "../ingestion/zod-schemas";
import type { LeadInput } from "../ingestion/leads";
import { AGENTS } from "@/app/_data/dataset";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const id = (...parts: string[]) => parts.map(slug).join("_").slice(0, 64);

async function ensureAgent(prisma: PrismaClient, agentId: string) {
  const meta = AGENTS.find((a) => a.id === agentId);
  await prisma.agent.upsert({
    where: { id: agentId },
    update: {},
    create: {
      id: agentId,
      name: meta?.name ?? agentId,
      role: (meta?.role ?? "ADVISOR") as never,
      segment: (meta?.segment ?? "NA") as never,
      status: meta?.status === "FORMER" ? "INACTIVE" : "ACTIVE",
      exemptFromAtRisk: meta?.exempt ?? false,
    },
  });
}

async function ensureDeveloper(prisma: PrismaClient, rawName: string): Promise<string> {
  const name = canonicalizeDeveloper(rawName) ?? rawName;
  const key = slug(name);
  const dev = await prisma.developer.upsert({ where: { canonicalKey: key }, update: { name }, create: { name, canonicalKey: key } });
  await prisma.developerCommissionRule.upsert({
    where: { developerId_minQuarterlyVolume: { developerId: dev.id, minQuarterlyVolume: 0 } },
    update: {},
    create: { developerId: dev.id, minQuarterlyVolume: 0, rate: 0.03, tierName: "Flat" },
  });
  return dev.id;
}

async function ensureProject(prisma: PrismaClient, developerId: string, rawName: string): Promise<string> {
  const name = canonicalizeProject(rawName) ?? rawName ?? "Unknown";
  const proj = await prisma.project.upsert({ where: { developerId_name: { developerId, name } }, update: {}, create: { developerId, name } });
  return proj.id;
}

export async function writeDeals(prisma: PrismaClient, agentId: string, deals: DealInput[]) {
  await ensureAgent(prisma, agentId);
  for (const d of deals) {
    const developerId = await ensureDeveloper(prisma, d.developerName);
    const projectId = await ensureProject(prisma, developerId, d.projectName);
    const stage = d.closeDate && /closed|sold/i.test(d.stageRaw ?? "closed") ? "CLOSED_WON" : d.closeDate ? "CLOSED_WON" : "RESERVATION";
    const dealId = id("dl", agentId, d.clientName, d.unitNumber ?? "");

    const deal = await prisma.deal.upsert({
      where: { id: dealId },
      update: { dealValue: d.dealValue, canonicalStage: stage as never, clientName: d.clientName, closeDate: d.closeDate ?? null, developerId, projectId, unitType: d.unitType, unitNumber: d.unitNumber },
      create: { id: dealId, dealValue: d.dealValue, canonicalStage: stage as never, clientName: d.clientName, closeDate: d.closeDate ?? null, developerId, projectId, unitType: d.unitType, unitNumber: d.unitNumber },
    });

    const attributionId = id("at", deal.id, agentId);
    await prisma.dealAttribution.upsert({
      where: { id: attributionId },
      update: { sharePct: 1 },
      create: { id: attributionId, dealId: deal.id, agentId, sharePct: 1, role: "PRIMARY" },
    });

    const alwalaaGross = applyRate(d.dealValue, d.developerRate);
    const split = d.agentSplitRaw ?? 0;
    await prisma.commission.upsert({
      where: { attributionId },
      update: { developerRate: d.developerRate, alwalaaGross, agentSplitRate: split, agentPayout: applyRate(alwalaaGross, split), developerPaid: d.devPaid === "RECEIVED" ? "RECEIVED" : "UNPAID", agentPaid: d.agentPaid === "PAID" ? "PAID" : "UNPAID" },
      create: { dealId: deal.id, attributionId, developerRate: d.developerRate, alwalaaGross, agentSplitRate: split, agentPayout: applyRate(alwalaaGross, split), developerPaid: d.devPaid === "RECEIVED" ? "RECEIVED" : "UNPAID", agentPaid: d.agentPaid === "PAID" ? "PAID" : "UNPAID", attributionReason: d.leadSource },
    });
  }
}

export async function writeLeads(prisma: PrismaClient, agentId: string, leads: LeadInput[]) {
  await ensureAgent(prisma, agentId);
  for (const l of leads) {
    const leadId = id("ld", agentId, l.name, l.contact ?? "");
    const common = {
      canonicalStage: l.stage as never,
      assignedAgentId: agentId,
      source: l.source as never,
      rawStageLabel: l.rawStage,
      contact: l.contact,
      email: l.email,
      nationality: l.nationality,
      countryOfResidence: l.country,
      budgetBand: l.budget,
      purpose: l.purpose,
      lastFollowUpAt: l.lastFollowUp ?? null,
      registeredAt: l.registeredOn ?? null,
    };
    await prisma.lead.upsert({
      where: { id: leadId },
      update: common,
      create: { id: leadId, name: l.name, title: l.title, ...common },
    });
  }
}
