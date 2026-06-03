// Single data source for the dashboards. Reads live data from the database once
// it has been synced from Google Sheets; otherwise falls back to the baked
// snapshot so the app always works. Pages call loadData() and pass the bundle
// to the (pure) compute helpers and client tables.
import { hasDatabase, prisma } from "@/infrastructure/prisma/client";
import {
  AGENTS, DEALS, LEADS,
  type AgentRecord, type DealRecord, type LeadRecord, type SourceTag,
} from "./dataset";

export interface DataBundle {
  agents: AgentRecord[];
  deals: DealRecord[];
  leads: LeadRecord[];
  live: boolean;
}

const STATIC: DataBundle = { agents: AGENTS, deals: DEALS, leads: LEADS, live: false };
const num = (v: unknown) => Number(v as never);
const RECORD_ROLES = ["SENIOR", "ADVISOR", "NEW", "TRAINEE", "HEAD_OF_SALES", "MARKETING", "FINANCE", "CEO"];

function period(date: Date | null): string {
  const d = date ?? new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function defaultTarget(role: string): number {
  return role === "SENIOR" ? 350000 : role === "ADVISOR" ? 250000 : role === "NEW" ? 120000 : 0;
}

export async function loadData(): Promise<DataBundle> {
  if (!hasDatabase) return STATIC;
  try {
    const [dbAgents, dbDeals, dbLeads, targets] = await Promise.all([
      prisma.agent.findMany(),
      prisma.deal.findMany({ include: { developer: true, project: true, attributions: { include: { commission: true } } } }),
      prisma.lead.findMany({ include: { assignedAgent: true } }),
      prisma.target.findMany(),
    ]);

    // Empty DB (not synced yet) → keep the snapshot.
    if (dbDeals.length === 0 && dbLeads.length === 0) return STATIC;

    const targetByAgent = new Map<string, number>();
    for (const t of targets) targetByAgent.set(t.agentId, Math.max(targetByAgent.get(t.agentId) ?? 0, num(t.targetAmount)));

    const agents: AgentRecord[] = dbAgents.map((a) => {
      const meta = AGENTS.find((x) => x.id === a.id);
      const role = (RECORD_ROLES.includes(a.role) ? a.role : "ADVISOR") as AgentRecord["role"];
      return {
        id: a.id,
        name: a.name,
        role,
        segment: a.segment as AgentRecord["segment"],
        target: targetByAgent.get(a.id) ?? defaultTarget(a.role),
        rampEndDate: a.rampEndDate ? a.rampEndDate.toISOString().slice(0, 10) : undefined,
        exempt: a.exemptFromAtRisk,
        status: a.status === "INACTIVE" ? "FORMER" : "ACTIVE",
        driveFolder: meta?.driveFolder,
        closedDocs: meta?.closedDocs,
        vouchers: meta?.vouchers,
      };
    });

    const deals: DealRecord[] = [];
    for (const d of dbDeals) {
      for (const at of d.attributions) {
        const c = at.commission;
        const reason = c?.attributionReason ?? "ALWALAA_SOURCED";
        deals.push({
          id: at.id,
          agentId: at.agentId,
          client: d.clientName ?? "—",
          developer: d.developer.name,
          project: d.project.name,
          unitType: d.unitType ?? "",
          unitNumber: d.unitNumber ?? "",
          value: num(d.dealValue) * num(at.sharePct),
          devRatePct: c ? num(c.developerRate) * 100 : 0,
          gross: c ? num(c.alwalaaGross) : 0,
          splitPct: c ? num(c.agentSplitRate) * 100 : 0,
          payout: c ? num(c.agentPayout) : 0,
          source: (reason.includes("AGENT_NETWORK") ? "OWN" : "ALWALAA") as SourceTag,
          devPaid: c?.developerPaid === "RECEIVED" ? "RECEIVED" : "NOT_RECEIVED",
          agentPaid: c?.agentPaid === "PAID" ? "PAID" : "NOT_PAID",
          closeDate: d.closeDate ? d.closeDate.toISOString().slice(0, 10) : null,
          period: period(d.closeDate),
          stage: d.canonicalStage === "CLOSED_WON" ? "CLOSED_WON" : "RESERVATION",
        });
      }
    }

    const leads: LeadRecord[] = dbLeads.map((l) => ({
      id: l.id,
      agentId: l.assignedAgentId,
      title: l.title ?? "",
      name: l.name,
      phoneRaw: l.contact ?? "",
      email: l.email,
      country: l.countryOfResidence,
      nationality: l.nationality,
      language: l.language,
      budget: l.budgetBand,
      purpose: l.purpose,
      projectInterest: null,
      source: (l.source === "AGENT_NETWORK" ? "OWN" : "ALWALAA") as SourceTag,
      rawStage: l.rawStageLabel ?? "",
      stage: l.canonicalStage,
      dealStatus: null,
      registeredOn: l.registeredAt ? l.registeredAt.toISOString().slice(0, 10) : null,
      lastFollowUp: l.lastFollowUpAt ? l.lastFollowUpAt.toISOString().slice(0, 10) : null,
      notes: l.notes,
    }));

    return { agents, deals, leads, live: true };
  } catch {
    return STATIC;
  }
}
