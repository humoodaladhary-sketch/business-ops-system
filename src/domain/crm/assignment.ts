// Assignment rules engine (C3). Ordered rules, first match wins; otherwise
// round-robin weighted by inverse open-lead load. Pure + tested.

export interface RuleCondition {
  language?: "ar" | "en";
  countryIn?: string[]; // ISO-3166 alpha-2
  sourceIn?: string[]; // LeadChannel values
  budgetMin?: number;
  budgetMax?: number;
}

export interface AssignmentRule {
  id: string;
  label?: string;
  when: RuleCondition;
  thenAgentId?: string; // assign to a specific agent
  thenPool?: "senior" | "round_robin"; // or a pool strategy
}

export interface LeadAssignCtx {
  language?: string | null;
  country?: string | null;
  source?: string | null;
  budget?: number | null;
}

export interface AgentLoad {
  agentId: string;
  openLeads: number;
  active: boolean;
  senior?: boolean;
}

export interface AssignResult {
  agentId: string | null;
  ruleId: string | null;
  reason: string;
}

function matches(c: RuleCondition, lead: LeadAssignCtx): boolean {
  if (c.language && lead.language !== c.language) return false;
  if (c.countryIn && !(lead.country && c.countryIn.includes(lead.country))) return false;
  if (c.sourceIn && !(lead.source && c.sourceIn.includes(lead.source))) return false;
  if (c.budgetMin != null && !(lead.budget != null && lead.budget >= c.budgetMin)) return false;
  if (c.budgetMax != null && !(lead.budget != null && lead.budget <= c.budgetMax)) return false;
  return true;
}

function leastLoaded(agents: AgentLoad[]): string | null {
  if (agents.length === 0) return null;
  return agents.reduce((best, a) => (a.openLeads < best.openLeads ? a : best)).agentId;
}

export function resolveAssignment(lead: LeadAssignCtx, rules: AssignmentRule[], agents: AgentLoad[]): AssignResult {
  const active = agents.filter((a) => a.active);

  for (const rule of rules) {
    if (!matches(rule.when, lead)) continue;
    if (rule.thenAgentId && active.some((a) => a.agentId === rule.thenAgentId)) {
      return { agentId: rule.thenAgentId, ruleId: rule.id, reason: rule.label ?? "rule:agent" };
    }
    if (rule.thenPool === "senior") {
      const pick = leastLoaded(active.filter((a) => a.senior));
      if (pick) return { agentId: pick, ruleId: rule.id, reason: rule.label ?? "rule:senior pool" };
    }
    if (rule.thenPool === "round_robin") {
      const pick = leastLoaded(active);
      if (pick) return { agentId: pick, ruleId: rule.id, reason: rule.label ?? "rule:round-robin" };
    }
  }

  return { agentId: leastLoaded(active), ruleId: null, reason: "default: inverse-load round-robin" };
}
