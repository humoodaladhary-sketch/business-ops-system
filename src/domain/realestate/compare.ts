// Unit comparison for Pro Mode: 2–3 candidate units, one client, a tailored
// side-by-side and a final recommendation. Pure and deterministic — every
// point of score maps to a stated reason, and no market figure is invented:
// the only forward-looking element is the residency tier, which carries its
// own ROP disclaimer. Composes buildOffer() so eligibility, payment plans and
// the reservation promo stay single-sourced.
import { buildOffer, type Offer, type OfferInput, type OfferUnit } from "./offer";
import { residencyTier, type ResidencyTierResult } from "./calculators";

export interface CompareInput {
  clientName: string;
  nationality: string;
  goal: string; // "Capital growth" | "Rental income" | "Residency" | "Lifestyle" | "Flip"
  budgetOmr: number; // 0 = no budget given
  units: OfferUnit[]; // 2–3 candidates
}

export interface ComparisonRow {
  unit: OfferUnit;
  offer: Offer;
  eligible: boolean;
  pricePerSqmOmr: number;
  withinBudget: boolean | null; // null when no budget given
  budgetDeltaOmr: number | null; // negative = under budget
  residency: ResidencyTierResult;
  score: number;
  reasons: string[];
}

export interface Comparison {
  rows: ComparisonRow[];
  recommendedRef: string | null;
  recommendationReasons: string[];
  notes: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildComparison(input: CompareInput): Comparison {
  if (input.units.length < 2 || input.units.length > 3) {
    throw new Error("Comparison needs 2 or 3 units.");
  }

  const rows: ComparisonRow[] = input.units.map((unit) => {
    const offerInput: OfferInput = {
      clientName: input.clientName,
      nationality: input.nationality,
      goal: input.goal,
      budgetOmr: input.budgetOmr,
      unit,
      closingToday: false,
      reservationOffer: false,
    };
    const offer = buildOffer(offerInput);
    const pricePerSqm = unit.areaSqm > 0 ? unit.priceOmr / unit.areaSqm : 0;
    const withinBudget = input.budgetOmr > 0 ? unit.priceOmr <= input.budgetOmr : null;
    return {
      unit,
      offer,
      eligible: offer.eligibility.ok,
      pricePerSqmOmr: round1(pricePerSqm),
      withinBudget,
      budgetDeltaOmr: input.budgetOmr > 0 ? unit.priceOmr - input.budgetOmr : null,
      residency: residencyTier({ priceOmr: unit.priceOmr }),
      score: 0,
      reasons: [],
    };
  });

  // Bench figures for relative scoring come only from the candidate set.
  const eligible = rows.filter((r) => r.eligible);
  const bestPsm = Math.min(...eligible.filter((r) => r.pricePerSqmOmr > 0).map((r) => r.pricePerSqmOmr), Infinity);
  const lowestPrice = Math.min(...eligible.map((r) => r.unit.priceOmr), Infinity);
  const largestArea = Math.max(...eligible.map((r) => r.unit.areaSqm), 0);

  for (const r of rows) {
    if (!r.eligible) {
      r.reasons.push(`Excluded: ${r.offer.eligibility.reason}`);
      continue;
    }
    if (r.withinBudget === true) {
      r.score += 40;
      r.reasons.push("Within the stated budget");
    } else if (r.withinBudget === false) {
      r.reasons.push(`Over budget by ${Math.round(r.budgetDeltaOmr ?? 0).toLocaleString()} OMR`);
    }
    if (r.pricePerSqmOmr > 0 && r.pricePerSqmOmr === bestPsm) {
      r.score += 20;
      r.reasons.push("Best price per m² of the shortlist");
    }
    const goal = input.goal.toLowerCase();
    if (goal.includes("residency")) {
      // Residency is the stated goal — the tier reached dominates the ranking.
      if (r.residency.tier === "golden_10yr") {
        r.score += 40;
        r.reasons.push("Meets the 200,000 OMR Golden/Investor Residency threshold");
      } else if (r.residency.tier === "investor_2yr") {
        r.score += 15;
        r.reasons.push("Meets the 50,000 OMR Investor Residency threshold");
      }
    } else if (goal.includes("rental")) {
      if (r.unit.priceOmr === lowestPrice) {
        r.score += 10;
        r.reasons.push("Lowest entry ticket of the shortlist — smallest capital at risk for letting");
      }
    } else if (goal.includes("flip")) {
      if (r.unit.priceOmr === lowestPrice) {
        r.score += 10;
        r.reasons.push("Lowest total price — easiest resale ticket");
      }
    } else if (goal.includes("lifestyle")) {
      if (r.unit.areaSqm === largestArea && largestArea > 0) {
        r.score += 10;
        r.reasons.push("Largest living area of the shortlist");
      }
    } else {
      // Capital growth (default): efficiency of the entry price.
      if (r.pricePerSqmOmr > 0 && r.pricePerSqmOmr === bestPsm) {
        r.score += 10;
        r.reasons.push("Most efficient entry price for growth");
      }
    }
    // Small headroom bonus: comfortably inside budget beats scraping the cap.
    if (r.withinBudget === true && (r.budgetDeltaOmr ?? 0) <= -0.1 * input.budgetOmr) {
      r.score += 5;
      r.reasons.push("Leaves >10% budget headroom");
    }
  }

  // Recommendation: highest score among eligible; ties break to lower price.
  const ranked = [...eligible].sort((a, b) => b.score - a.score || a.unit.priceOmr - b.unit.priceOmr);
  const top = ranked[0] ?? null;

  const notes: string[] = [
    "Comparison uses only the unit facts entered and the shortlist itself — no market yields or appreciation are assumed.",
  ];
  if (rows.some((r) => !r.eligible)) {
    notes.push("Units marked excluded are not open to this client's nationality and are shown for transparency only.");
  }

  return {
    rows,
    recommendedRef: top ? top.unit.reference : null,
    recommendationReasons: top
      ? [
          `Highest fit score (${top.score}) for ${input.clientName || "the client"}'s stated goal — ${input.goal}.`,
          ...top.reasons,
        ]
      : ["No unit on this shortlist is open to the client's nationality — select ITC freehold alternatives."],
    notes,
  };
}
