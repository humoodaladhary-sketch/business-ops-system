// Demo dataset built from the real audited Shatha + Alex deals (Feb 2026), run
// through the actual domain engine. Lets the dashboard render with truthful
// numbers before the database / Sheets sync is wired. Swap for the Prisma
// repositories (src/infrastructure/prisma) once DATABASE_URL is configured.
import {
  computeMonthlyPerformance,
  evaluateAtRisk,
  computeNextTierNudge,
  type AtRiskMonth,
  type LeadSource,
  type MonthlyDealLine,
  type MonthlyPerformanceResult,
  type AtRiskResult,
  type NextTierNudge,
} from "@/domain";
import { DEFAULT_LADDER, DEFAULT_FLOORS } from "./config";

export const DEMO_PERIOD = "2026-02";

interface DemoDeal {
  dealId: string;
  client: string;
  developer: string;
  project: string;
  value: number;
  devRate: number; // fraction
  source: LeadSource;
}

interface DemoAgentSpec {
  id: string;
  name: string;
  role: string;
  target: number;
  deals: DemoDeal[];
  history: AtRiskMonth[]; // two months incl. current
  exempt?: boolean;
  inRampWindow?: boolean;
}

// Real Shatha closings in Feb 2026 (Sarooj @4%, Ahly Sabbour @3.5%).
const shathaDeals: DemoDeal[] = [
  ["Momen", "Sarooj Development", "Sarooj Oasis", 62914.5, 0.04],
  ["Asaduzzaman & Ali-Zaman", "Sarooj Development", "Sarooj Oasis", 50150, 0.04],
  ["Mohamood Entezar", "Sarooj Development", "Sarooj Oasis", 173920, 0.04],
  ["Mohamood Entezar (2)", "Sarooj Development", "Sarooj Oasis", 92650, 0.04],
  ["Mhasood Entezar", "Sarooj Development", "Sarooj Oasis", 56100, 0.04],
  ["Alan Ang", "Sarooj Development", "Sarooj Oasis", 56100, 0.04],
  ["Nahida Karim", "Sarooj Development", "Sarooj Oasis", 54450, 0.04],
  ["Nahida Karim (WZ)", "Ahly Sabbour", "Wadi Zaha", 143715, 0.035],
].map(([client, developer, project, value, devRate], i) => ({
  dealId: `sh-${i + 1}`,
  client: client as string,
  developer: developer as string,
  project: project as string,
  value: value as number,
  devRate: devRate as number,
  source: "ALWALAA_SOURCED" as LeadSource,
}));

// Real Alex closings in Feb 2026 (all Alwalaa-sourced).
const alexDeals: DemoDeal[] = [
  ["Salahudin", "Ahly Sabbour", "Wadi Zaha", 77000, 0.035],
  ["Zia Ul Haq", "Ahly Sabbour", "Wadi Zaha", 63200, 0.035],
  ["Mohd. Ayaz", "Sarooj Development", "Sarooj Oasis", 61346.25, 0.04],
].map(([client, developer, project, value, devRate], i) => ({
  dealId: `ax-${i + 1}`,
  client: client as string,
  developer: developer as string,
  project: project as string,
  value: value as number,
  devRate: devRate as number,
  source: "ALWALAA_SOURCED" as LeadSource,
}));

const SPECS: DemoAgentSpec[] = [
  {
    id: "shatha",
    name: "Shatha Al Manthari",
    role: "SENIOR",
    target: 350000,
    deals: shathaDeals,
    history: [
      { period: "2026-01", pctOfTarget: 1.4, dealCount: 3 },
      { period: "2026-02", pctOfTarget: 1.97, dealCount: 8 },
    ],
  },
  {
    id: "alex",
    name: "Alex Showran",
    role: "ADVISOR",
    target: 250000,
    deals: alexDeals,
    history: [
      { period: "2026-01", pctOfTarget: 0.9, dealCount: 2 },
      { period: "2026-02", pctOfTarget: 0.806, dealCount: 3 },
    ],
  },
  {
    id: "wesam",
    name: "Wesam Zeno",
    role: "ADVISOR",
    target: 250000,
    // One Alwalaa deal — but two consecutive sub-50% months trips At Risk.
    deals: [
      { dealId: "wz-1", client: "Private client", developer: "Ahly Sabbour", project: "Wadi Zaha", value: 120000, devRate: 0.035, source: "ALWALAA_SOURCED" },
    ],
    history: [
      { period: "2026-01", pctOfTarget: 0.48, dealCount: 1 },
      { period: "2026-02", pctOfTarget: 0.48, dealCount: 1 },
    ],
  },
  {
    id: "pasha",
    name: "Pasha",
    role: "ADVISOR",
    target: 250000,
    deals: [],
    history: [
      { period: "2026-01", pctOfTarget: 0, dealCount: 0 },
      { period: "2026-02", pctOfTarget: 0, dealCount: 0 },
    ],
  },
  {
    id: "khalid",
    name: "Khalid",
    role: "NEW",
    target: 120000,
    inRampWindow: true,
    // An own-lead deal — hybrid floor lifts this 50% even in a low tier.
    deals: [
      { dealId: "kh-1", client: "Referred buyer", developer: "Adante Realty", project: "Yenaire", value: 60000, devRate: 0.03, source: "AGENT_NETWORK" },
    ],
    history: [
      { period: "2026-01", pctOfTarget: 0.2, dealCount: 1 },
      { period: "2026-02", pctOfTarget: 0.5, dealCount: 1 },
    ],
  },
  {
    id: "tariq",
    name: "Tariq",
    role: "TRAINEE",
    target: 0,
    exempt: true,
    deals: [],
    history: [{ period: "2026-02", pctOfTarget: 0, dealCount: 0 }],
  },
];

export interface DemoAgentView {
  id: string;
  name: string;
  role: string;
  exempt: boolean;
  inRampWindow: boolean;
  result: MonthlyPerformanceResult;
  atRisk: AtRiskResult;
  nudge: NextTierNudge;
  deals: DemoDeal[];
}

function buildAgent(spec: DemoAgentSpec): DemoAgentView {
  const deals: MonthlyDealLine[] = spec.deals.map((d) => ({
    dealId: d.dealId,
    attributionId: `attr-${d.dealId}`,
    dealValue: d.value,
    sharePct: 1,
    developerRate: d.devRate,
    leadSource: d.source,
    attributionReason: d.source === "AGENT_NETWORK" ? "Own/Referral lead" : "Alwalaa lead",
  }));

  const result = computeMonthlyPerformance({
    agentId: spec.id,
    period: DEMO_PERIOD,
    targetAmount: spec.target,
    deals,
    ladder: DEFAULT_LADDER,
    floors: DEFAULT_FLOORS,
  });

  const atRisk = evaluateAtRisk({
    exempt: spec.exempt ?? false,
    inRampWindow: spec.inRampWindow ?? false,
    months: spec.history,
  });

  const nudge = computeNextTierNudge({
    volumeClosed: result.volumeClosed,
    targetAmount: spec.target,
    ladder: DEFAULT_LADDER,
    alwalaaGrossMonth: result.alwalaaGrossMonth,
  });

  return {
    id: spec.id,
    name: spec.name,
    role: spec.role,
    exempt: spec.exempt ?? false,
    inRampWindow: spec.inRampWindow ?? false,
    result,
    atRisk,
    nudge,
    deals: spec.deals,
  };
}

export function getDemoAgents(): DemoAgentView[] {
  return SPECS.map(buildAgent);
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

export function getDemoCommissions(): CommissionRow[] {
  const rows: CommissionRow[] = [];
  for (const a of getDemoAgents()) {
    const meta = new Map(a.deals.map((d) => [d.dealId, d]));
    for (const c of a.result.commissions) {
      const d = meta.get(c.dealId)!;
      rows.push({
        dealId: c.dealId,
        agent: a.name,
        client: d.client,
        developer: d.developer,
        project: d.project,
        dealValue: d.value,
        developerRate: c.developerRate,
        alwalaaGross: c.alwalaaGross,
        agentSplitRate: c.agentSplitRate,
        agentPayout: c.agentPayout,
        source: c.attributionReason,
      });
    }
  }
  return rows.sort((a, b) => b.agentPayout - a.agentPayout);
}

// Canonical pipeline distribution grounded in the audited lead funnels.
export const DEMO_PIPELINE: Record<string, number> = {
  NEW: 8,
  QUALIFIED: 52,
  ENGAGED: 9,
  VIEWING: 4,
  NEGOTIATION: 18,
  RESERVATION: 6,
  CLOSED_WON: 14,
  CLOSED_LOST: 47,
};
