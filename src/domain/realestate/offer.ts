// Pure offer builder for Alwalaa Real Estate. Composes the real-estate
// calculators into a single client-ready investment offer and renders it to
// Markdown. Money is OMR; areas are m². Client-facing output NEVER shows
// internal commission figures — the Offer type deliberately has no commission
// field, so leakage is impossible by construction.
import {
  paymentPlan,
  residencyTier,
  type PaymentPlanResult,
  type ResidencyTierResult,
} from "./calculators";
import { roundOMR, d } from "../money";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type UnitCategory = "ITC" | "future_cities" | "surooh";
export type OwnershipEligibility = "all_nationalities" | "gcc_omani_only";

export interface OfferUnit {
  reference: string;
  project: string;
  developer: string;
  unitType: string;
  areaSqm: number;
  priceOmr: number;
  category: UnitCategory;
  ownershipEligibility: OwnershipEligibility;
}

export interface OfferInput {
  clientName: string;
  nationality: string;
  goal: string;
  budgetOmr: number;
  unit: OfferUnit;
  /** True when the client is closing today (unlocks the reservation promo). */
  closingToday?: boolean;
  /** True when the client wants the reservation promo applied. */
  reservationOffer?: boolean;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface OfferEligibility {
  ok: boolean;
  reason: string;
}

export interface OfferReservationOffer {
  /** True only when closingToday AND reservationOffer were both requested. */
  applies: boolean;
  amountOmr: number;
  condition: string;
}

export interface Offer {
  header: string;
  eligibility: OfferEligibility;
  unit: OfferUnit;
  priceOmr: number;
  /** Price per square metre in OMR (3 dp). */
  pricePerSqmOmr: number;
  paymentPlan: PaymentPlanResult;
  residency: ResidencyTierResult;
  reservationOffer: OfferReservationOffer;
  assumptions: string[];
  validityDays: number;
  footerNote: string;
}

// ---------------------------------------------------------------------------
// GCC eligibility
// ---------------------------------------------------------------------------

// Names, adjectivals and ISO alpha-2/alpha-3 codes for the six GCC states,
// stored as compact alphanumeric keys so spacing/punctuation ("U.A.E.",
// "Saudi Arabia") match. Compared case-insensitively after normalization.
const GCC_TOKENS = new Set<string>([
  // Oman
  "oman", "omani", "om", "omn",
  // Saudi Arabia
  "saudiarabia", "saudi", "saudiarabian", "ksa", "sa", "sau",
  // United Arab Emirates
  "unitedarabemirates", "uae", "emirati", "emirates", "ae", "are",
  // Kuwait
  "kuwait", "kuwaiti", "kw", "kwt",
  // Qatar
  "qatar", "qatari", "qa", "qat",
  // Bahrain
  "bahrain", "bahraini", "bh", "bhr",
]);

/** Normalize a nationality to a compact key: lowercase, drop leading "the", strip all non-alphanumerics. */
function normalizeNationality(nationality: string): string {
  return nationality
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Loosely detect whether a nationality is GCC (Oman, KSA, UAE, Kuwait, Qatar, Bahrain). */
export function isGccNationality(nationality: string): boolean {
  return GCC_TOKENS.has(normalizeNationality(nationality));
}

// ---------------------------------------------------------------------------
// buildOffer
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<UnitCategory, string> = {
  ITC: "ITC freehold",
  future_cities: "Future Cities",
  surooh: "Surooh",
};

/**
 * Composes the calculators into a client-ready offer.
 *
 * Eligibility rule: a NON-GCC client cannot take freehold title in a
 * `gcc_omani_only` unit, so `eligibility.ok` is false and the reason steers
 * them to Alwalaa's ITC freehold stock (open to all nationalities).
 *
 * The reservation promo (fixed 500 OMR, "Reserve today") applies ONLY when the
 * client is both closing today and asked for it; when it applies, the 500 OMR
 * reservation is folded into the payment plan.
 */
export function buildOffer(input: OfferInput): Offer {
  const { unit } = input;

  const isGcc = isGccNationality(input.nationality);
  const gccOnly = unit.ownershipEligibility === "gcc_omani_only";
  const ok = !(gccOnly && !isGcc);
  const reason = ok
    ? gccOnly
      ? "This unit is restricted to GCC/Omani buyers; the client qualifies."
      : "Open to all nationalities — foreign freehold ownership is permitted."
    : `This unit is restricted to GCC/Omani buyers, so a ${input.nationality} national cannot take freehold title here. ` +
      "We recommend Alwalaa's ITC freehold stock, which is open to all nationalities and carries Golden/Investor Residency eligibility.";

  const pricePerSqmOmr = unit.areaSqm > 0 ? roundOMR(d(unit.priceOmr).dividedBy(unit.areaSqm)) : 0;

  const reservationApplies = Boolean(input.closingToday && input.reservationOffer);
  const RESERVATION_AMOUNT_OMR = 500;

  const plan = paymentPlan({
    priceOmr: unit.priceOmr,
    reservationOmr: reservationApplies ? RESERVATION_AMOUNT_OMR : 0,
  });

  const residency = residencyTier({ priceOmr: unit.priceOmr });

  const assumptions = [
    "Prices are in Omani Rial (OMR); 1 m² pricing shown for comparison.",
    "The payment plan is indicative and subject to the developer's final terms.",
    "Residency eligibility is guidance only — final approval rests with the Royal Oman Police.",
    "Any USD figures use an indicative pegged rate of 1 OMR = 2.60 USD.",
    "Offer is subject to unit availability and developer confirmation at signing.",
  ];

  return {
    header: `Alwalaa Real Estate — Investment Offer: ${unit.project} (${unit.reference})`,
    eligibility: { ok, reason },
    unit,
    priceOmr: unit.priceOmr,
    pricePerSqmOmr,
    paymentPlan: plan,
    residency,
    reservationOffer: {
      applies: reservationApplies,
      amountOmr: RESERVATION_AMOUNT_OMR,
      condition: "Reserve today",
    },
    assumptions,
    validityDays: 7,
    footerNote:
      "All prices in Omani Rial (OMR). This offer is indicative, valid for 7 days from issue, and " +
      "subject to unit availability and developer confirmation. It is not financial, tax or legal advice. " +
      "Alwalaa Real Estate, Muscat, Sultanate of Oman.",
  };
}

// ---------------------------------------------------------------------------
// Markdown rendering (client-ready — no internal commissions)
// ---------------------------------------------------------------------------

/** Format an OMR amount the same way as the app's formatOMR (mirrored to keep the domain layer pure). */
function omr(n: number): string {
  return (
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n) +
    " OMR"
  );
}

/** Format an m² area with up to 2 dp. */
function sqm(n: number): string {
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)} m²`;
}

function dueLabel(months: number): string {
  if (months <= 0) return "On signing";
  if (months === 1) return "In 1 month";
  return `In ${months} months`;
}

/**
 * Renders an Offer as a clean, client-ready Markdown document in OMR and m²
 * with a payment-plan table. Internal commission data is never included.
 */
export function offerToMarkdown(offer: Offer): string {
  const u = offer.unit;
  const lines: string[] = [];

  lines.push(`# ${offer.header}`);
  lines.push("");

  if (!offer.eligibility.ok) {
    lines.push(`> **Ownership note:** ${offer.eligibility.reason}`);
    lines.push("");
  }

  lines.push("## Unit");
  lines.push("");
  lines.push(`- **Reference:** ${u.reference}`);
  lines.push(`- **Project:** ${u.project}`);
  lines.push(`- **Developer:** ${u.developer}`);
  lines.push(`- **Type:** ${u.unitType}`);
  lines.push(`- **Category:** ${CATEGORY_LABEL[u.category]}`);
  lines.push(`- **Area:** ${sqm(u.areaSqm)}`);
  lines.push(`- **Price:** ${omr(offer.priceOmr)}`);
  lines.push(`- **Price / m²:** ${omr(offer.pricePerSqmOmr)}`);
  lines.push("");

  lines.push("## Residency");
  lines.push("");
  lines.push(offer.residency.note);
  lines.push("");

  if (offer.reservationOffer.applies) {
    lines.push(
      `> **Reservation offer:** ${offer.reservationOffer.condition} for ${omr(offer.reservationOffer.amountOmr)} to secure this unit.`,
    );
    lines.push("");
  }

  lines.push("## Payment plan");
  lines.push("");
  lines.push(`Total price: **${omr(offer.priceOmr)}**`);
  lines.push("");
  lines.push("| Payment | Due | Amount |");
  lines.push("| --- | --- | ---: |");
  for (const step of offer.paymentPlan.schedule) {
    lines.push(`| ${step.label} | ${dueLabel(step.dueMonthsFromNow)} | ${omr(step.amountOmr)} |`);
  }
  lines.push("");

  lines.push("## Assumptions");
  lines.push("");
  for (const a of offer.assumptions) {
    lines.push(`- ${a}`);
  }
  lines.push("");

  lines.push(`_Valid for ${offer.validityDays} days._`);
  lines.push("");
  lines.push(`_${offer.footerNote}_`);

  return lines.join("\n");
}
