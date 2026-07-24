import type { CanonicalStage } from "../types";

export interface ExistingLeadRef {
  id: string;
  clientId: string | null;
  stage: CanonicalStage;
}

export type IngestDecision =
  | { action: "ATTACH_TOUCH"; leadId: string; clientId: string | null }
  | { action: "NEW_LEAD"; clientId: string | null };

const isOpen = (stage: CanonicalStage) => stage !== "CLOSED_WON" && stage !== "CLOSED_LOST";

/**
 * Dedup-on-ingest decision (C1), given the leads already on this phone (E.164):
 *  - an OPEN lead exists        -> attach the inbound as a new touch (no dup)
 *  - only closed/dead leads     -> new lead linked to the SAME client
 *  - no prior leads             -> brand-new lead + new client
 */
export function decideIngest(existing: ExistingLeadRef[]): IngestDecision {
  const open = existing.find((l) => isOpen(l.stage));
  if (open) return { action: "ATTACH_TOUCH", leadId: open.id, clientId: open.clientId };
  const prior = existing[0];
  if (prior) return { action: "NEW_LEAD", clientId: prior.clientId };
  return { action: "NEW_LEAD", clientId: null };
}
