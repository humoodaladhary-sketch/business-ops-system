// Adapter: turns the real consolidated dataset into the view-models the
// dashboards consume, computing tier/nudge via the domain engine (the July
// ladder, shown as a preview) alongside the LEGACY recorded payouts in force
// until COMP_NEW_EFFECTIVE.
import {
  computeMonthlyPerformance,
  evaluateAtRisk,
  computeNextTierNudge,
  type LeadSource,
  type MonthlyDealLine,
  type MonthlyPerformanceResult,
  type AtRiskResult,
  type NextTierNudge,
} from "@/domain";
import { DEFAULT_LADDER, DEFAULT_FLOORS } from "./config";
import {
  AGENTS,
  DEALS,
  LEADS,
  DASHBOARD_PERIOD,
  type DealRecord,
} from "./dataset";

export const DEMO_PERIOD = DASHBOARD_PERIOD;

function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function closedInPeriod(agentId: string, period: string): DealRecord[] {
  return DEALS.filter((d) => d.agentId === agentId && d.period === period && d.stage === "CLOSED_WON");
}

function toLines(deals: DealRecord[]): MonthlyDealLine[] {
  return deals.map((d) => ({
    dealId: d.id,
    attributionId: `attr-${d.id}`,
    dealValue: d.value,
    sharePct: 1,
    developerRate: d.devRatePct / 100,
    leadSource: (d.source === "ALWALAA" ? "ALWALAA_SOURCED" : "AGENT_NETWORK") as LeadSource,
    attributionReason: d.source === "ALWALAA" ? "Alwalaa lead" : "Own/Referral lead",
  }));
}

export interface DemoAgentView {
  id: string;
  name: string;
  role: string;
  exempt: boolean;
  inRampWindow: boolean;
  result: MonthlyPerformanceResult;
  atRisk: AtRiskResult;
  nudge: NextTierNudge;
  legacyPayout: number; // recorded actuals for the period
}

function buildAgent(agentId: string, period: string): DemoAgentView {
  const a = AGENTS.find((x) => x.id === agentId)!;
  const deals = closedInPeriod(agentId, period);
  const result = computeMonthlyPerformance({
    agentId,
    period,
    targetAmount: a.target,
    deals: toLines(deals),
    ladder: DEFAULT_LADDER,
    floors: DEFAULT_FLOORS,
  });
  const legacyPayout = deals.reduce((s, d) => s + d.payout, 0);

  const prev = closedInPeriod(agentId, prevPeriod(period));
  const prevVol = prev.reduce((s, d) => s + d.value, 0);
  const months = [
    { period: prevPeriod(period), pctOfTarget: a.target ? prevVol / a.target : 0, dealCount: prev.length },
    { period, pctOfTarget: result.pctOfTarget, dealCount: result.dealCount },
  ];
  const atRisk = evaluateAtRisk({
    exempt: a.exempt ?? false,
    inRampWindow: a.rampEndDate ? new Date(a.rampEndDate).getTime() > Date.now() : false,
    months,
  });

  const nudge = computeNextTierNudge({
    volumeClosed: result.volumeClosed,
    targetAmount: a.target,
    ladder: DEFAULT_LADDER,
    alwalaaGrossMonth: result.alwalaaGrossMonth,
  });

  return {
    id: a.id,
    name: a.name,
    role: a.role,
    exempt: a.exempt ?? false,
    inRampWindow: a.rampEndDate ? new Date(a.rampEndDate).getTime() > Date.now() : false,
    result,
    atRisk,
    nudge,
    legacyPayout,
  };
}

// Agents that carry a sales target appear on the performance views.
const SCORING = AGENTS.filter((a) => ["SENIOR", "ADVISOR", "NEW", "HEAD_OF_SALES"].includes(a.role));

export function getDemoAgents(): DemoAgentView[] {
  return SCORING.map((a) => buildAgent(a.id, DEMO_PERIOD));
}

export interface CommissionRow {
  dealId: string;
  agent: string;
  client: string;
  developer: string;
  project: string;
  dealValue: number;
  developerRate: number;
  alwalaaGross: number;
  agentSplitRate: number;
  agentPayout: number;
  source: string;
}

const NAME = new Map(AGENTS.map((a) => [a.id, a.name]));

export function getDemoCommissions(): CommissionRow[] {
  return DEALS.filter((d) => d.period === DEMO_PERIOD && d.stage === "CLOSED_WON")
    .map((d) => ({
      dealId: d.id,
      agent: NAME.get(d.agentId) ?? d.agentId,
      client: d.client,
      developer: d.developer,
      project: d.project,
      dealValue: d.value,
      developerRate: d.devRatePct / 100,
      alwalaaGross: d.gross,
      agentSplitRate: d.splitPct / 100,
      agentPayout: d.payout,
      source: d.source === "ALWALAA" ? "Alwalaa lead" : d.source === "REFERRAL" ? "Referral" : "Own lead",
    }))
    .sort((a, b) => b.agentPayout - a.agentPayout);
}

// Canonical pipeline counts derived from the real lead set.
export const DEMO_PIPELINE: Record<string, number> = LEADS.reduce(
  (acc, l) => {
    acc[l.stage] = (acc[l.stage] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);
