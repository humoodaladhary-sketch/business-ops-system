// Editable CRM configuration with safe defaults. Persisted in the Setting table
// (key -> JSON) and read at runtime, falling back to these defaults. No deploy
// needed to tune.

export interface ScoringWeights {
  source: Record<string, number>; // LeadChannel -> points
  budgetFitMax: number; // 0..25
  respondedUnder1h: number;
  openedConversation: number;
  residencyIntent: number;
  perInboundTouch: number;
  touchCap: number;
  hotMin: number;
  warmMin: number;
}

export const DEFAULT_SCORING: ScoringWeights = {
  source: {
    REFERRAL: 25, WHATSAPP: 20, WALKIN: 20, INSTAGRAM_LEAD_AD: 15, FACEBOOK_LEAD_AD: 15,
    GOOGLE_LEAD_FORM: 15, WEBSITE: 12, INSTAGRAM_DM: 12, INSTAGRAM_COMMENT: 10, PORTAL_FEED: 10,
    MANUAL: 8, IMPORT: 5,
  },
  budgetFitMax: 25,
  respondedUnder1h: 15,
  openedConversation: 5,
  residencyIntent: 15,
  perInboundTouch: 3,
  touchCap: 15,
  hotMin: 70,
  warmMin: 40,
};

export type ForecastProbabilities = Record<string, number>;
export const DEFAULT_FORECAST: ForecastProbabilities = {
  NEW: 0.02, QUALIFIED: 0.05, ENGAGED: 0.1, VIEWING: 0.25,
  NEGOTIATION: 0.5, RESERVATION: 0.8, CLOSED_WON: 1, CLOSED_LOST: 0,
};

export interface MatchingWeights {
  budgetBandPct: number; // ± tolerance on price (0.15 = ±15%)
  typeWeight: number;
  projectWeight: number;
  residencyWeight: number;
}
export const DEFAULT_MATCHING: MatchingWeights = { budgetBandPct: 0.15, typeWeight: 1, projectWeight: 1, residencyWeight: 0.5 };

export interface SlaSettings {
  responseDueMinutes: number;
}
export const DEFAULT_SLA: SlaSettings = { responseDueMinutes: 30 };

export const DEFAULT_SETTINGS = {
  scoring: DEFAULT_SCORING,
  forecast: DEFAULT_FORECAST,
  matching: DEFAULT_MATCHING,
  sla: DEFAULT_SLA,
};
export type SettingsKey = keyof typeof DEFAULT_SETTINGS;
