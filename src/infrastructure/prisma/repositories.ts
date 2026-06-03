import { resolveDeveloperRate, type LeadSource, type MonthlyDealLine } from "@/domain";
import type {
  AgentSummary,
  ConfigPort,
  MonthHistory,
  PerformancePort,
  RewardSettings,
} from "@/application/ports";
import { prisma } from "./client";
import { monthRange, quarterRange } from "./periods";

const num = (v: unknown): number => Number(v as never);

export class PrismaConfigRepository implements ConfigPort {
  async getLadder() {
    const tiers = await prisma.commissionLadder.findMany({ orderBy: { sortOrder: "asc" } });
    return tiers.map((t) => ({
      tierName: t.tierName,
      minPctOfTarget: num(t.minPctOfTarget),
      maxPctOfTarget: t.maxPctOfTarget == null ? null : num(t.maxPctOfTarget),
      agentSplitRate: num(t.agentSplitRate),
      sortOrder: t.sortOrder,
    }));
  }

  async getFloors() {
    const floors = await prisma.leadSourceFloor.findMany();
    return floors.map((f) => ({ source: f.source as LeadSource, floorSplitRate: num(f.floorSplitRate) }));
  }

  async getRewardSettings(): Promise<RewardSettings> {
    // Reward amounts are config; defaults here until a settings table is added.
    return { overachieverBonus: 1000, streakBonus: 2000, topTierNames: ["Top"] };
  }
}

export class PrismaPerformanceRepository implements PerformancePort {
  async listAgents(): Promise<AgentSummary[]> {
    const agents = await prisma.agent.findMany({
      where: { status: { not: "INACTIVE" }, role: { in: ["SENIOR", "ADVISOR", "NEW", "TRAINEE"] } },
    });
    const now = Date.now();
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      segment: a.segment,
      exemptFromAtRisk: a.exemptFromAtRisk,
      inRampWindow: a.rampEndDate ? a.rampEndDate.getTime() > now : false,
    }));
  }

  async getTarget(agentId: string, period: string): Promise<number> {
    const t = await prisma.target.findUnique({ where: { agentId_period: { agentId, period } } });
    return t ? num(t.targetAmount) : 0;
  }

  async getClosedDealLines(agentId: string, period: string): Promise<MonthlyDealLine[]> {
    const { start, end } = monthRange(period);
    const attrs = await prisma.dealAttribution.findMany({
      where: {
        agentId,
        deal: { canonicalStage: "CLOSED_WON", closeDate: { gte: start, lt: end } },
      },
      include: { deal: { include: { developer: { include: { rules: true } }, lead: true } } },
    });

    const qVolCache = new Map<string, number>();
    const lines: MonthlyDealLine[] = [];
    for (const a of attrs) {
      const devId = a.deal.developerId;
      if (!qVolCache.has(devId)) qVolCache.set(devId, await this.quarterlyVolume(devId, period));
      const rules = a.deal.developer.rules.map((r) => ({
        minQuarterlyVolume: num(r.minQuarterlyVolume),
        maxQuarterlyVolume: r.maxQuarterlyVolume == null ? null : num(r.maxQuarterlyVolume),
        rate: num(r.rate),
      }));
      const developerRate = resolveDeveloperRate(qVolCache.get(devId)!, rules);
      const leadSource = (a.deal.lead?.source ?? "ALWALAA_SOURCED") as LeadSource;
      lines.push({
        dealId: a.dealId,
        attributionId: a.id,
        dealValue: num(a.deal.dealValue),
        sharePct: num(a.sharePct),
        developerRate,
        leadSource,
        attributionReason: leadSource === "AGENT_NETWORK" ? "Own/Referral lead" : "Alwalaa lead",
      });
    }
    return lines;
  }

  async getMonthHistory(agentId: string, periods: string[]): Promise<MonthHistory[]> {
    const out: MonthHistory[] = [];
    for (const period of periods) {
      const [target, lines] = await Promise.all([
        this.getTarget(agentId, period),
        this.getClosedDealLines(agentId, period),
      ]);
      const volume = lines.reduce((s, l) => s + l.dealValue * l.sharePct, 0);
      out.push({ period, pctOfTarget: target > 0 ? volume / target : 0, dealCount: lines.length });
    }
    return out;
  }

  private async quarterlyVolume(developerId: string, period: string): Promise<number> {
    const { start, end } = quarterRange(period);
    const agg = await prisma.deal.aggregate({
      _sum: { dealValue: true },
      where: { developerId, canonicalStage: "CLOSED_WON", closeDate: { gte: start, lt: end } },
    });
    return num(agg._sum.dealValue ?? 0);
  }
}
