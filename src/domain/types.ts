// Pure-TS domain types. String-literal unions intentionally mirror the Prisma
// enum values so the domain layer stays free of any framework/ORM import.

export type CanonicalStage =
  | "NEW"
  | "QUALIFIED"
  | "ENGAGED"
  | "VIEWING"
  | "NEGOTIATION"
  | "RESERVATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export type LeadSource = "ALWALAA_SOURCED" | "AGENT_NETWORK";
export type SnapshotStatus = "PROVISIONAL" | "FINAL";
export type AttributionRole = "PRIMARY" | "CO_BROKER" | "REFERRER";
export type RewardType = "AGENT_OF_MONTH" | "OVERACHIEVER_BONUS" | "STREAK_BONUS";

/** One rung of the performance ladder. Rates/pcts are fractions (0.50 = 50%). */
export interface LadderTier {
  tierName: string;
  minPctOfTarget: number; // inclusive
  maxPctOfTarget: number | null; // exclusive; null = open-ended top tier
  agentSplitRate: number;
  sortOrder: number;
}

/** Lead-source floor (Decision 1). floorSplitRate 0 = no floor (ladder only). */
export interface SourceFloor {
  source: LeadSource;
  floorSplitRate: number;
}

/** Developer→Alwalaa rate rule, tiered by cumulative quarterly volume (Decision 4). */
export interface DeveloperRateRule {
  tierName?: string | null;
  minQuarterlyVolume: number; // inclusive
  maxQuarterlyVolume: number | null; // exclusive; null = open-ended
  rate: number; // fraction
}
