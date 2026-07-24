import type { ScoringWeights } from "./settings";

export type ScoreBand = "HOT" | "WARM" | "COLD";

export interface ScoreInput {
  channel?: string | null; // LeadChannel
  budgetFit?: number; // 0..1 fit vs inventory
  respondedUnder1h?: boolean;
  openedConversation?: boolean;
  residencyIntent?: boolean;
  inboundTouches?: number;
}

export interface ScoreResult {
  score: number; // 0..100
  band: ScoreBand;
  breakdown: Record<string, number>;
}

/** Transparent 0–100 lead score from configurable weights (C2). */
export function computeLeadScore(input: ScoreInput, w: ScoringWeights): ScoreResult {
  const breakdown: Record<string, number> = {};
  breakdown.source = w.source[String(input.channel ?? "").toUpperCase()] ?? 0;
  breakdown.budgetFit = Math.round(Math.max(0, Math.min(1, input.budgetFit ?? 0)) * w.budgetFitMax);
  breakdown.responsiveness = (input.respondedUnder1h ? w.respondedUnder1h : 0) + (input.openedConversation ? w.openedConversation : 0);
  breakdown.residencyIntent = input.residencyIntent ? w.residencyIntent : 0;
  breakdown.engagement = Math.min((input.inboundTouches ?? 0) * w.perInboundTouch, w.touchCap);

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, raw));
  const band: ScoreBand = score >= w.hotMin ? "HOT" : score >= w.warmMin ? "WARM" : "COLD";
  return { score, band, breakdown };
}
