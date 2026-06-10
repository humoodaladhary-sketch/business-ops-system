// Property <-> lead matching (C5). Pure + tested; weights from Settings.
import type { MatchingWeights } from "./settings";

export interface UnitRef {
  id: string;
  projectId?: string | null;
  market: "OFF_PLAN" | "SECONDARY";
  unitType: string;
  bedrooms?: number | null;
  priceOMR?: number | null;
  status: string;
  residencyTier?: string | null;
  published?: boolean;
}

export interface LeadMatchCtx {
  budget?: number | null;
  unitType?: string | null;
  projectInterestId?: string | null;
  bedrooms?: number | null;
  residencyTier?: string | null;
}

export interface UnitMatch {
  unitId: string;
  score: number;
  reasons: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function scoreUnit(lead: LeadMatchCtx, u: UnitRef, w: MatchingWeights): UnitMatch {
  let score = 0;
  const reasons: string[] = [];

  if (lead.budget && u.priceOMR) {
    const lo = u.priceOMR * (1 - w.budgetBandPct);
    const hi = u.priceOMR * (1 + w.budgetBandPct);
    if (lead.budget >= lo && lead.budget <= hi) {
      score += 2;
      reasons.push("budget fit");
    } else if (lead.budget >= u.priceOMR * 0.7 && lead.budget <= u.priceOMR * 1.3) {
      score += 1;
      reasons.push("near budget");
    }
  }
  if (lead.unitType && u.unitType && norm(lead.unitType) === norm(u.unitType)) {
    score += w.typeWeight;
    reasons.push("type");
  }
  if (lead.bedrooms != null && u.bedrooms != null && lead.bedrooms === u.bedrooms) {
    score += w.typeWeight * 0.5;
    reasons.push("bedrooms");
  }
  if (lead.projectInterestId && u.projectId === lead.projectInterestId) {
    score += w.projectWeight;
    reasons.push("project");
  }
  if (lead.residencyTier && u.residencyTier && lead.residencyTier === u.residencyTier) {
    score += w.residencyWeight;
    reasons.push("residency tier");
  }
  return { unitId: u.id, score, reasons };
}

/** Top-N available units for a lead, best first. */
export function matchUnits(lead: LeadMatchCtx, units: UnitRef[], w: MatchingWeights, topN = 5): UnitMatch[] {
  return units
    .filter((u) => u.status === "AVAILABLE")
    .map((u) => scoreUnit(lead, u, w))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

export interface MatchableLead {
  id: string;
  agentId: string | null;
  open: boolean;
  ctx: LeadMatchCtx;
}

/** When a new unit lands: which agents own open leads that match it. */
export function agentsToNotifyForUnit(
  unit: UnitRef,
  leads: MatchableLead[],
  w: MatchingWeights,
): { agentId: string; leadIds: string[] }[] {
  const byAgent = new Map<string, string[]>();
  for (const l of leads) {
    if (!l.open || !l.agentId) continue;
    if (matchUnits(l.ctx, [{ ...unit, status: "AVAILABLE" }], w, 1).length > 0) {
      const arr = byAgent.get(l.agentId) ?? [];
      arr.push(l.id);
      byAgent.set(l.agentId, arr);
    }
  }
  return Array.from(byAgent, ([agentId, leadIds]) => ({ agentId, leadIds }));
}
