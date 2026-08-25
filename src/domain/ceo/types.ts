// The CEO Command Center domain model.
//
// Two rules shape every type here:
//
//  1. Money is integer baisa (see `baisa.ts`). Every money field ends in `Baisa`.
//  2. Nothing is overwritten — cost rules are effective-dated rows, and people
//     are archived with an end date, never deleted. Raising a salary in
//     September must leave August's cost and August's ROI exactly as they were.

import type { Baisa } from "./baisa";
import type { IsoDate, MonthKey } from "./calendar";

/** A label authored in both languages. Never machine-translated at render. */
export interface Bilingual {
  en: string;
  ar: string;
}

/**
 * What a person does — decides which metrics their card owns. Showing "0 deals"
 * on a marketing manager's card is a bug, not a fact.
 */
export type PersonClass =
  | "Owner"
  | "Advisor"
  | "Inventory"
  | "LeadEngine"
  | "Marketing"
  | "Finance"
  | "Contractor";

/**
 * What the person costs the company under statutory rules. This is a payroll
 * classification, not a nationality record: it decides whether employer social
 * insurance or end-of-service accrual applies.
 */
export type PayrollClass =
  | "OmaniEmployee"
  | "ExpatEmployee"
  | "Contractor"
  /**
   * Status not yet confirmed. Carries no statutory cost — and is surfaced as a
   * data gap by `payrollClassificationGaps` whenever such a person is employed
   * under a policy that has statutory rules, so "unknown" never passes as "nil".
   */
  | "Unclassified";

/**
 * How the person's pay is treated in company reporting. The founder's pay is an
 * owner distribution: it is a real cash cost and belongs in payroll and
 * break-even, but he is never ranked against the advisors.
 */
export type CostTreatment = "operating" | "ownerDistribution";

export interface Person {
  id: string;
  name: Bilingual;
  role: Bilingual;
  personClass: PersonClass;
  payrollClass: PayrollClass;
  costTreatment: CostTreatment;
  basicBaisa: Baisa;
  allowanceBaisa: Baisa;
  /** Advisor's share of gross commission, as a percent (25 means 25%). */
  commissionCutPct: number;
  /**
   * The date this person's numbers start being measured. This is the deal
   * record's baseline, NOT necessarily the legal hire date — some staff were
   * with the company before the record begins.
   */
  measurementStartDate: IsoDate;
  /** Legal hire date, when known. Deliberately separate so the two never merge. */
  hireDate: IsoDate | null;
  /** Set when they leave. Their history stays in the company record forever. */
  endedAt: IsoDate | null;
}

export type DealStage = "SPA_SIGNED" | "RESERVED" | "CANCELLED";
/** Invoicing / collection state. "unknown" is a real answer in the 2026 book. */
export type TriState = "yes" | "no" | "unknown";

export interface Deal {
  ref: string;
  month: MonthKey;
  /** `Person.id` of the advisor credited with the deal. */
  advisorId: string;
  developer: string;
  project: string;
  unitType: string;
  unitValueBaisa: Baisa;
  /** Developer's commission to Alwalaa, as a percent of unit value. */
  commissionPct: number;
  grossCommissionBaisa: Baisa;
  /** Developer incentive on top of commission. Adds to company net. */
  incentiveBaisa: Baisa;
  referralPayee: string | null;
  referralPct: number;
  referralBaisa: Baisa;
  agentCutPct: number;
  agentAmountBaisa: Baisa;
  /**
   * The net as recorded in the source sheet. Kept for reconciliation only —
   * `companyNet()` recomputes it from components and is the authority.
   */
  recordedCompanyNetBaisa: Baisa;
  stage: DealStage;
  invoiced: TriState;
  collected: TriState;
}

/** A statutory cost rule that takes effect from a date and is never edited after. */
export interface SocialInsuranceRule {
  /** Employer contribution, as a percent. */
  ratePct: number;
  /** Contributions are assessed on wage up to this ceiling. */
  contributoryWageCapBaisa: Baisa;
  /**
   * Which wage the contribution is assessed on. Today: basic. The risk that the
   * authorities re-base this on total wage is modelled as a scenario, not a cost.
   */
  basis: "basic" | "totalWage";
  appliesTo: readonly PayrollClass[];
}

export interface EndOfServiceRule {
  /** Monthly accrual is wage ÷ divisor. 12 gives one month's wage per year. */
  divisor: number;
  basis: "basic" | "totalWage";
  appliesTo: readonly PayrollClass[];
}

export interface OverheadLine {
  id: string;
  label: Bilingual;
  /**
   * Null means "known to exist, not yet priced". It must surface as a visible
   * gap on every screen that shows fixed cost. Never render it as zero.
   */
  amountBaisa: Baisa | null;
}

/**
 * A cost regime, effective from a date. When the rules change again it is a new
 * row, not a deploy and not an if-statement on the date.
 */
export interface CostPolicy {
  id: string;
  label: Bilingual;
  effectiveFrom: IsoDate;
  socialInsurance: SocialInsuranceRule | null;
  endOfService: EndOfServiceRule | null;
  overheads: readonly OverheadLine[];
  note?: Bilingual;
}

/**
 * A liability the system must SHOW but must not invent a number for. An
 * amount of `null` renders as "amount unknown", never as zero, and stays
 * visible until it is settled or dismissed.
 */
export interface Provision {
  id: string;
  label: Bilingual;
  amountBaisa: Baisa | null;
  flag: Bilingual;
  status: "open" | "settled" | "dismissed";
}

export interface BonusBand {
  id: string;
  label: Bilingual;
  /** Inclusive lower bound of monthly volume. */
  minVolumeBaisa: Baisa;
  /** Exclusive upper bound, or null for the top band. */
  maxVolumeBaisa: Baisa | null;
  bonusBaisa: Baisa;
}

export interface CompanySettings {
  currency: "OMR";
  /** Monthly volume target for an advisor. */
  advisorMonthlyTargetBaisa: Baisa;
  /** Half-width of the "on target" band around the target. */
  targetBandBaisa: Baisa;
  bonusBands: readonly BonusBand[];
  holidays: readonly IsoDate[];
}

/** An inclusive month window. */
export interface MonthWindow {
  from: MonthKey;
  to: MonthKey;
}

export interface CeoDataset {
  people: readonly Person[];
  deals: readonly Deal[];
  costPolicies: readonly CostPolicy[];
  provisions: readonly Provision[];
  settings: CompanySettings;
}
