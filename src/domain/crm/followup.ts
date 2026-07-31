// Deterministic follow-up nudges — the pipeline-side twin of finance/aging.
// Pure functions over recorded touches only: a lead with no last_touch_at is
// never guessed into a staleness number, it is classified "no_touch_recorded"
// and surfaced on its own. Closed leads are never nudged.

import { CANONICAL_STAGES, isOpen, stageOrder } from "../stage";
import type { CanonicalStage } from "../types";

/**
 * Days since the last recorded touch before a stage counts as stale.
 * Later stages are closer to money and go cold faster.
 */
export const STAGE_FOLLOWUP_DAYS: Record<Exclude<CanonicalStage, "CLOSED_WON" | "CLOSED_LOST">, number> = {
  NEW: 2,
  QUALIFIED: 7,
  ENGAGED: 7,
  VIEWING: 3,
  NEGOTIATION: 3,
  RESERVATION: 2,
};

export type FollowupReason = "stale" | "no_touch_recorded";

export const FOLLOWUP_REASON_LABELS: Record<FollowupReason, string> = {
  stale: "Stale — past the stage's follow-up window",
  no_touch_recorded: "No touch recorded",
};

export interface FollowupLead {
  id: string;
  name: string;
  stage: string; // canonical stage, any case; unknown stages are skipped
  lastTouch: string | null; // YYYY-MM-DD or ISO timestamp
  registeredOn?: string | null; // context for no-touch rows only
}

export interface FollowupNudge {
  id: string;
  name: string;
  stage: CanonicalStage;
  reason: FollowupReason;
  /** Whole days since the last recorded touch; null when none is recorded. */
  daysSinceTouch: number | null;
  thresholdDays: number;
  /** How far past the stage window; null for no_touch_recorded rows. */
  daysOverThreshold: number | null;
  /** Whole days since registration; shown for no-touch rows. */
  daysSinceRegistered: number | null;
}

export interface FollowupSummary {
  openCount: number;
  dueCount: number;
  staleCount: number;
  noTouchCount: number;
  /** Due nudges per stage (canonical keys, only stages with due rows). */
  byStage: Partial<Record<CanonicalStage, number>>;
  /** Due nudges worst-first: most days over threshold, later stage on ties;
   *  no-touch rows follow verified-stale rows, oldest registration first. */
  queue: FollowupNudge[];
}

const DAY_MS = 86_400_000;
const utcDay = (d: Date) => Math.floor(d.getTime() / DAY_MS);

function daysBetween(date: string | null | undefined, asOf: Date): number | null {
  if (!date) return null;
  const parsed = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
  if (Number.isNaN(parsed.getTime())) return null;
  return utcDay(asOf) - utcDay(parsed);
}

function toCanonical(stage: string): CanonicalStage | null {
  const upper = stage.toUpperCase() as CanonicalStage;
  return CANONICAL_STAGES.includes(upper) ? upper : null;
}

/** Classify one open-stage lead; null when no nudge is due. */
export function classifyFollowup(lead: FollowupLead, asOf: Date): FollowupNudge | null {
  const stage = toCanonical(lead.stage);
  if (!stage || !isOpen(stage)) return null;
  const thresholdDays = STAGE_FOLLOWUP_DAYS[stage as keyof typeof STAGE_FOLLOWUP_DAYS];
  const daysSinceTouch = daysBetween(lead.lastTouch, asOf);
  const daysSinceRegistered = daysBetween(lead.registeredOn, asOf);
  if (daysSinceTouch == null) {
    return {
      id: lead.id,
      name: lead.name,
      stage,
      reason: "no_touch_recorded",
      daysSinceTouch: null,
      thresholdDays,
      daysOverThreshold: null,
      daysSinceRegistered,
    };
  }
  if (daysSinceTouch <= thresholdDays) return null;
  return {
    id: lead.id,
    name: lead.name,
    stage,
    reason: "stale",
    daysSinceTouch,
    thresholdDays,
    daysOverThreshold: daysSinceTouch - thresholdDays,
    daysSinceRegistered,
  };
}

export function summarizeFollowups(leads: FollowupLead[], asOf: Date): FollowupSummary {
  const open = leads.filter((l) => {
    const stage = toCanonical(l.stage);
    return stage != null && isOpen(stage);
  });
  const queue = open
    .map((l) => classifyFollowup(l, asOf))
    .filter((n): n is FollowupNudge => n !== null);
  queue.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "stale" ? -1 : 1;
    if (a.reason === "stale") {
      const over = (b.daysOverThreshold ?? 0) - (a.daysOverThreshold ?? 0);
      if (over !== 0) return over;
      return stageOrder(b.stage) - stageOrder(a.stage);
    }
    return (b.daysSinceRegistered ?? -1) - (a.daysSinceRegistered ?? -1);
  });
  const byStage: FollowupSummary["byStage"] = {};
  for (const n of queue) byStage[n.stage] = (byStage[n.stage] ?? 0) + 1;
  return {
    openCount: open.length,
    dueCount: queue.length,
    staleCount: queue.filter((n) => n.reason === "stale").length,
    noTouchCount: queue.filter((n) => n.reason === "no_touch_recorded").length,
    byStage,
    queue,
  };
}
