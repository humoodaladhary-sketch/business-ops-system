import type { CanonicalStage } from "./types";

// The single canonical pipeline. Order matters for funnel math & sorting.
export const CANONICAL_STAGES: CanonicalStage[] = [
  "NEW",
  "QUALIFIED",
  "ENGAGED",
  "VIEWING",
  "NEGOTIATION",
  "RESERVATION",
  "CLOSED_WON",
  "CLOSED_LOST",
];

export const STAGE_LABELS: Record<CanonicalStage, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  ENGAGED: "Engaged",
  VIEWING: "Viewing",
  NEGOTIATION: "Negotiation",
  RESERVATION: "Reservation",
  CLOSED_WON: "Closed-Won",
  CLOSED_LOST: "Closed-Lost",
};

export function isWon(stage: CanonicalStage): boolean {
  return stage === "CLOSED_WON";
}

export function isOpen(stage: CanonicalStage): boolean {
  return stage !== "CLOSED_WON" && stage !== "CLOSED_LOST";
}

export function stageOrder(stage: CanonicalStage): number {
  return CANONICAL_STAGES.indexOf(stage);
}
