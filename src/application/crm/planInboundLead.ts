// Pure planner for an inbound lead (C1+C2+C3): enrich → score → dedup → assign.
// No I/O — the route supplies existing leads / projects / agent loads / settings
// and persists the plan. Testable in isolation.
import {
  parsePhone,
  detectLanguage,
  extractBudget,
  hasResidencyIntent,
  matchProjectInterest,
  computeLeadScore,
  decideIngest,
  resolveAssignment,
  type ScoringWeights,
  type AssignmentRule,
  type AgentLoad,
  type AssignResult,
  type ProjectRef,
  type ExistingLeadRef,
  type IngestDecision,
} from "@/domain";

export interface InboundPayload {
  phone: string;
  name?: string | null;
  message?: string | null;
  source: string; // LeadChannel
  sourceRef?: string | null;
}

export interface PlanCtx {
  existing: ExistingLeadRef[];
  projects: ProjectRef[];
  agents: AgentLoad[];
  scoring: ScoringWeights;
  rules: AssignmentRule[];
}

export interface InboundPlan {
  enriched: {
    e164: string | null;
    country: string | null;
    language: "ar" | "en";
    budget: number | null;
    residencyIntent: boolean;
    projectInterestId: string | null;
  };
  score: { score: number; band: string };
  dedup: IngestDecision;
  assignment: AssignResult | null; // null when attaching a touch to an existing lead
}

export function planInboundLead(p: InboundPayload, ctx: PlanCtx): InboundPlan {
  const phone = parsePhone(p.phone);
  const text = `${p.name ?? ""} ${p.message ?? ""}`.trim();
  const language = detectLanguage(text || null);
  const budget = extractBudget(p.message)?.amount ?? null;
  const residencyIntent = hasResidencyIntent(text);
  const projectInterestId = matchProjectInterest(p.message ?? null, ctx.projects);

  // budgetFit is filled in by C5 inventory matching; 0 here.
  const scored = computeLeadScore(
    { channel: p.source, budgetFit: 0, residencyIntent, inboundTouches: ctx.existing.length + 1 },
    ctx.scoring,
  );

  const dedup = decideIngest(ctx.existing);
  const assignment =
    dedup.action === "NEW_LEAD"
      ? resolveAssignment({ language, country: phone.country, source: p.source, budget }, ctx.rules, ctx.agents)
      : null;

  return {
    enriched: { e164: phone.e164, country: phone.country, language, budget, residencyIntent, projectInterestId },
    score: { score: scored.score, band: scored.band },
    dedup,
    assignment,
  };
}
