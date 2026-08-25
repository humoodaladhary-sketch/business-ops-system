// Turns a real inventory unit into a publication brief: the facts a listing may
// state, the claims it may NOT make, and the platform's shape.
//
// This is the layer that stops the marketing copy from writing cheques the title
// deed cannot cash. A unit in a Future Cities or Surooh master plan cannot be
// sold freehold to a non-GCC buyer, so a listing for it must not mention foreign
// ownership or the Golden/Investor Residency pathway — however good the copy.
// The gate is computed here, in pure code, and passed to the model as a hard
// constraint rather than left to its judgement.
//
// It is equally strict about invention. `InventoryUnit` carries no floor area,
// no handover date, no service charge and no amenity list, so the brief states
// plainly that those are unknown and forbids the model from supplying them.
// A listing with a plausible invented yield is worse than a short one.
//
// Pure: no framework, no I/O, no network.
import { omrToUsd, OMR_TO_USD_RATE, residencyTier } from "./calculators";
import { CATEGORY_LABELS, type UnitCategory } from "./offer";
import {
  eligibilityOf,
  foreignOwnershipAllowed,
  resolveProject,
  type ProjectRef,
  type ResolvedEligibility,
  type ResolvedProject,
} from "./project-resolver";
import { d, roundOMR } from "../money";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type ListingPlatform =
  | "instagram"
  | "whatsapp"
  | "linkedin"
  | "property_finder"
  | "dubizzle"
  | "opensouq"
  | "website";

export type ListingLanguage = "en" | "ar" | "both";

export type UnitStatus = "AVAILABLE" | "RESERVED" | "SOLD";

/** The unit as inventory holds it. Optional fields are genuinely often absent. */
export interface ListingUnitInput {
  id: string;
  project: string;
  developer: string;
  unitType: string;
  bedrooms: number | null;
  priceOMR: number;
  status: UnitStatus;
  published: boolean;
  /** Floor area in m², when the stock sheet carried one. */
  areaSqm?: number | null;
  /** The developer's unit reference, when known. */
  reference?: string | null;
}

export interface BuildListingBriefInput {
  unit: ListingUnitInput;
  platform: ListingPlatform;
  language: ListingLanguage;
  /** The signed master-plan catalogue, injected so the domain stays pure. */
  catalogue: readonly ProjectRef[];
  /** Optional extra angle from the operator ("mention the marina", "end-of-quarter"). */
  angle?: string;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface PlatformSpec {
  id: ListingPlatform;
  label: string;
  /** Soft ceiling on the body, in characters. */
  maxChars: number;
  /** Number of hashtags to produce; 0 means the platform takes none. */
  hashtags: number;
  /** The sections the model must return, in order. */
  sections: string[];
  /** Platform-specific rules folded into the prompt. */
  rules: string[];
}

export interface ListingBrief {
  unit: ListingUnitInput;
  platform: PlatformSpec;
  language: ListingLanguage;

  /** The matched master plan, with its trust level. */
  resolved: ResolvedProject;
  eligibility: ResolvedEligibility;
  /** True only for a trusted ITC match — gates every foreign-investor claim. */
  foreignOwnership: boolean;

  priceOmr: number;
  priceUsdIndicative: number;
  /** OMR per m², or null when inventory holds no area (the usual case). */
  pricePerSqmOmr: number | null;

  /** Statements the copy may make. Everything else must be omitted. */
  facts: string[];
  /** Hard prohibitions. These are non-negotiable, not stylistic preferences. */
  mustNot: string[];
  /** Fields inventory does not hold, named so the model does not invent them. */
  unknowns: string[];
  /** Operator-facing notes surfaced in the UI. */
  warnings: string[];

  /** False when the unit must not be advertised at all. */
  publishable: boolean;
  /** Why, when `publishable` is false. */
  blockedReason: string | null;

  angle: string | null;
}

// ---------------------------------------------------------------------------
// Platform specs
// ---------------------------------------------------------------------------

const PLATFORM_SPECS: Record<ListingPlatform, PlatformSpec> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    maxChars: 2200,
    hashtags: 10,
    sections: ["Hook (first line)", "Caption", "Hashtags", "Call to action"],
    rules: [
      "The first line must work as a standalone hook — it is all that shows before 'more'.",
      "Short paragraphs separated by blank lines; no walls of text.",
      "Restrained use of emoji — at most a handful, never in place of words.",
      "Hashtags go in one block at the end, not scattered through the caption.",
    ],
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    maxChars: 700,
    hashtags: 0,
    sections: ["Message", "Call to action"],
    rules: [
      "Written to one person, not to an audience. No hashtags.",
      "Short lines. WhatsApp bold (*text*) at most once.",
      "Exactly one ask at the end.",
    ],
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    maxChars: 1300,
    hashtags: 4,
    sections: ["Hook", "Body", "Hashtags", "Call to action"],
    rules: [
      "Professional register — an investment note, not an advert.",
      "Lead with the market point, arrive at the unit.",
      "No emoji.",
    ],
  },
  property_finder: {
    id: "property_finder",
    label: "Property Finder",
    maxChars: 2000,
    hashtags: 0,
    sections: ["Title", "Description", "Key details"],
    rules: [
      "Title at most 70 characters, no ALL CAPS, no exclamation marks.",
      "Do not put phone numbers, emails, WhatsApp links or URLs in the description — portals reject them.",
      "Key details as a plain labelled list, one field per line.",
    ],
  },
  dubizzle: {
    id: "dubizzle",
    label: "Dubizzle",
    maxChars: 2000,
    hashtags: 0,
    sections: ["Title", "Description", "Key details"],
    rules: [
      "Title at most 70 characters, no ALL CAPS.",
      "No contact details or URLs inside the description.",
      "Plain language; classifieds audience.",
    ],
  },
  opensouq: {
    id: "opensouq",
    label: "OpenSouq",
    maxChars: 2000,
    hashtags: 0,
    sections: ["Title", "Description", "Key details"],
    rules: [
      "Title at most 70 characters.",
      "No contact details or URLs inside the description.",
      "Keep the Arabic natural rather than a literal translation.",
    ],
  },
  website: {
    id: "website",
    label: "Alwalaa website",
    maxChars: 3000,
    hashtags: 0,
    sections: ["Headline", "Standfirst", "Body", "Specification", "Call to action"],
    rules: [
      "Long-form and editorial — this is the page the other channels link to.",
      "Specification as a labelled list of the known fields only.",
      "One clear call to action at the end.",
    ],
  },
};

/** All platforms, for populating a picker. */
export const LISTING_PLATFORMS: PlatformSpec[] = Object.values(PLATFORM_SPECS);

// ---------------------------------------------------------------------------
// buildListingBrief
// ---------------------------------------------------------------------------

const RESIDENCY_DISCLAIMER_FACT =
  "Residency eligibility is guidance only — final approval rests with the Royal Oman Police.";

function bedroomLabel(unit: ListingUnitInput): string {
  if (unit.bedrooms === null) return unit.unitType;
  if (unit.bedrooms === 0) return `${unit.unitType} (studio)`;
  return `${unit.unitType} · ${unit.bedrooms} bedroom${unit.bedrooms === 1 ? "" : "s"}`;
}

/**
 * Builds the publication brief for one unit on one platform.
 *
 * The ownership gate is the load-bearing part: `foreignOwnership` is true only
 * when the project resolved to an ITC master plan on an exact or curated-alias
 * match. A fuzzy match, or no match, yields `unknown` and is handled exactly as
 * a GCC-only restriction — the copy simply does not get to make the claim.
 */
export function buildListingBrief(input: BuildListingBriefInput): ListingBrief {
  const { unit, platform, language, catalogue } = input;

  const resolved = resolveProject(unit.project, catalogue);
  const eligibility = eligibilityOf(resolved);
  const foreignOwnership = foreignOwnershipAllowed(resolved);

  const priceOmr = unit.priceOMR;
  const areaSqm = unit.areaSqm ?? null;
  const pricePerSqmOmr =
    areaSqm && areaSqm > 0 ? roundOMR(d(priceOmr).dividedBy(areaSqm)) : null;

  const facts: string[] = [];
  const mustNot: string[] = [];
  const unknowns: string[] = [];
  const warnings: string[] = [];

  // --- Unit facts -----------------------------------------------------------
  facts.push(`Project: ${unit.project}`);
  facts.push(`Developer: ${unit.developer}`);
  facts.push(`Unit: ${bedroomLabel(unit)}`);
  if (unit.reference) facts.push(`Developer reference: ${unit.reference}`);
  facts.push(`Price: ${formatOmr(priceOmr)} (Omani Rial)`);
  facts.push(
    `Indicative USD equivalent: ${formatUsd(priceUsd(priceOmr))} at the pegged rate of 1 OMR = ${OMR_TO_USD_RATE} USD. Mark it as indicative if used.`,
  );
  if (pricePerSqmOmr !== null) {
    facts.push(`Area: ${areaSqm} m²`);
    facts.push(`Price per m²: ${formatOmr(pricePerSqmOmr)}`);
  }

  if (resolved.project) {
    facts.push(`Location: ${resolved.project.location}`);
    facts.push(`Master plan: ${resolved.project.name} (${CATEGORY_LABELS[resolved.project.category]})`);
    facts.push(`Governing authority: ${resolved.project.ministry}`);
  }

  // --- The ownership gate ---------------------------------------------------
  if (foreignOwnership) {
    facts.push(
      "Ownership: ITC freehold, open to buyers of every nationality — foreign freehold title is permitted here.",
    );
    const residency = residencyTier({ priceOmr });
    if (residency.tier === "golden_10yr") {
      facts.push(`Residency: at this price the purchase qualifies toward the 10-year Golden/Investor Residency. ${RESIDENCY_DISCLAIMER_FACT}`);
    } else if (residency.tier === "investor_2yr") {
      facts.push(`Residency: at this price the purchase qualifies toward the 2-year Investor Residency. ${RESIDENCY_DISCLAIMER_FACT}`);
      mustNot.push(
        "Do not claim the 10-year Golden Residency — this unit is priced below the 200,000 OMR threshold.",
      );
    } else {
      facts.push(
        "Residency: this unit is priced below the 50,000 OMR Investor Residency threshold and does not by itself qualify.",
      );
      mustNot.push(
        "Do not mention Golden Residency, Investor Residency or any residency pathway — this unit does not reach the threshold.",
      );
    }
  } else {
    const because =
      eligibility === "gcc_omani_only"
        ? `${resolved.project?.name ?? unit.project} is a ${CATEGORY_LABELS[resolved.project?.category ?? ("future_cities" as UnitCategory)]} master plan, restricted to Omani and GCC nationals.`
        : `the project could not be matched to a signed master plan with confidence (match: ${resolved.confidence}), so its ownership rule is unconfirmed.`;

    facts.push(`Ownership: this unit is for Omani and GCC buyers only — ${because}`);
    mustNot.push(
      "Do NOT state or imply that foreigners, expatriates or non-GCC nationals can buy or own this unit.",
      "Do NOT mention Golden Residency, Investor Residency, residency-by-investment or any visa pathway.",
      "Do NOT use the word 'freehold' unqualified, and do NOT target or address international investors.",
      "Do NOT translate the listing for an international-investor audience or frame Oman as an entry point for foreign capital.",
    );
    warnings.push(
      eligibility === "gcc_omani_only"
        ? "Omani/GCC buyers only — foreign-ownership and residency angles are blocked for this unit."
        : `Project '${unit.project}' did not match the signed catalogue with confidence, so this listing is written under the restrictive rule. Fix the project name in inventory to unlock the ITC angle if it qualifies.`,
    );
  }

  // --- Status ---------------------------------------------------------------
  let publishable = true;
  let blockedReason: string | null = null;

  if (unit.status === "SOLD") {
    publishable = false;
    blockedReason = "This unit is sold. Advertising sold stock as available misleads buyers and wastes the enquiry.";
    warnings.push(blockedReason);
  } else if (unit.status === "RESERVED") {
    facts.push("Availability: currently RESERVED — not free to sell.");
    mustNot.push(
      "Do NOT describe this unit as available. Frame it as reserved, and invite enquiries about similar units in the same project.",
    );
    warnings.push("Unit is reserved — the copy will be framed around similar stock rather than this unit.");
  } else {
    facts.push("Availability: available.");
  }

  if (!unit.published) {
    warnings.push("This unit is not published to the portal feed yet — publish it before the listing goes live.");
  }

  // --- What inventory does not know ----------------------------------------
  if (pricePerSqmOmr === null) unknowns.push("floor area (m²) and therefore price per m²");
  unknowns.push(
    "handover or completion date",
    "payment plan and instalment terms",
    "service charge",
    "rental yield, ROI or capital-appreciation figures",
    "amenities, finishes, views and floor level",
    "furnishing status and parking",
  );

  mustNot.push(
    `Do NOT invent, estimate or imply any of the following, which are not in our records: ${unknowns.join("; ")}. Omit them entirely rather than guessing.`,
    "Do NOT state a price in any currency other than OMR, except the indicative USD figure given above.",
    "Do NOT invent awards, occupancy rates, sales velocity, waiting lists or scarcity claims.",
    "Do NOT include internal commission, agent split or developer-rate information of any kind.",
  );

  // --- Language -------------------------------------------------------------
  if (language === "ar" || language === "both") {
    mustNot.push(
      "Write Arabic in Modern Standard Arabic, not a machine-literal translation of the English.",
      "Keep prices and numerals in Western Arabic digits (0-9) so portals parse them correctly.",
    );
  }

  return {
    unit,
    platform: PLATFORM_SPECS[platform],
    language,
    resolved,
    eligibility,
    foreignOwnership,
    priceOmr,
    priceUsdIndicative: priceUsd(priceOmr),
    pricePerSqmOmr,
    facts,
    mustNot,
    unknowns,
    warnings,
    publishable,
    blockedReason,
    angle: input.angle?.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

const LANGUAGE_INSTRUCTION: Record<ListingLanguage, string> = {
  en: "Write in English only.",
  ar: "Write in Arabic only (Modern Standard Arabic).",
  both: "Produce the full listing twice: first in English, then in Arabic (Modern Standard Arabic), under clear '## English' and '## العربية' headings.",
};

/**
 * Renders the brief as the instruction sent to the copilot.
 *
 * The prohibitions are stated before the creative task and repeated as a
 * closing constraint, because a model that has just written warm copy is most
 * likely to drift on the last line.
 */
export function listingBriefToPrompt(brief: ListingBrief): string {
  const { unit, platform } = brief;
  const lines: string[] = [];

  lines.push(
    `You are writing a property listing for Alwalaa Real Estate, a luxury brokerage in Muscat, Sultanate of Oman.`,
    ``,
    `## The unit`,
    ...brief.facts.map((f) => `- ${f}`),
    ``,
    `## Hard constraints — these override every other instruction`,
    ...brief.mustNot.map((m) => `- ${m}`),
    `- Use ONLY the facts listed above. If a detail is not listed, it is not known: leave it out.`,
    ``,
    `## Output`,
    `Platform: ${platform.label}.`,
    `Return these sections, in this order, each under a markdown heading: ${platform.sections.join(", ")}.`,
    `Keep the body under roughly ${platform.maxChars} characters.`,
    platform.hashtags > 0
      ? `Include ${platform.hashtags} relevant hashtags.`
      : `Do not include hashtags.`,
    ...platform.rules.map((r) => `- ${r}`),
    LANGUAGE_INSTRUCTION[brief.language],
  );

  if (brief.angle) {
    lines.push(``, `## Angle requested by the agent`, brief.angle);
  }

  lines.push(
    ``,
    `## Tone`,
    `Confident and understated. Specific over superlative — a real number beats an adjective.`,
    `Close with a call to action that invites a direct enquiry to Alwalaa.`,
    ``,
    `Write the listing now. Do not explain your choices, do not add commentary before or after, and do not ask questions.`,
    `Before you finish, re-read the hard constraints and remove anything that breaches them.`,
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Formatting helpers (mirrored from the app so the domain layer stays pure)
// ---------------------------------------------------------------------------

function priceUsd(omr: number): number {
  return omrToUsd(omr);
}

function formatOmr(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(n)} OMR`;
}

function formatUsd(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} USD`;
}
