// Resolves a free-text project name (as typed into inventory, or as it arrives
// on a developer stock sheet) onto the signed master-plan catalogue, so that a
// unit can be told apart as ITC freehold (open to every nationality) or
// Future Cities / Surooh stock (Omani and GCC buyers only).
//
// Why this exists: `InventoryUnit` carries only a project *name*. The ownership
// rule that governs what we may legally claim in a listing lives on the project.
// Without this join, marketing copy is generated with no idea whether foreign
// freehold is even permitted.
//
// FAIL-SAFE DIRECTION. Names drift between the stock sheet and the catalogue
// ("Hay Al Wafaa" vs "Hay Al Wafa", "Yenaire" vs "Yenaier Residences"), so a
// loose match is necessary. But a loose match that wrongly upgrades GCC-only
// stock to "all nationalities" is a compliance failure, while one that wrongly
// downgrades is merely a weaker advert. So an inexact match NEVER grants
// foreign-ownership eligibility: see `eligibilityOf`, which reports `unknown`
// unless the match is exact or an explicitly curated alias.
//
// Pure: no framework, no I/O. The catalogue is injected by the caller.
import type { OwnershipEligibility, UnitCategory } from "./offer";

/** The subset of a master-plan record this resolver needs. */
export interface ProjectRef {
  name: string;
  developer: string;
  location: string;
  category: UnitCategory;
  ownershipEligibility: OwnershipEligibility;
  ministry: string;
}

/**
 * How much the match can be trusted.
 * - `exact`  — normalized names are identical.
 * - `alias`  — a curated, human-reviewed spelling in ALIASES.
 * - `fuzzy`  — close enough to show, NOT close enough to make legal claims on.
 * - `none`   — no candidate.
 */
export type MatchConfidence = "exact" | "alias" | "fuzzy" | "none";

export interface ResolvedProject {
  /** The catalogue entry, or null when nothing matched. */
  project: ProjectRef | null;
  confidence: MatchConfidence;
  /** True when the match is firm enough to base ownership claims on. */
  trusted: boolean;
  /** The name we searched for, after normalization (useful in diagnostics). */
  normalizedQuery: string;
}

/**
 * Eligibility as the listing layer should treat it.
 * `unknown` means "we could not establish this" and must be handled as
 * restrictively as `gcc_omani_only` — never as permission to pitch foreigners.
 */
export type ResolvedEligibility = OwnershipEligibility | "unknown";

// ---------------------------------------------------------------------------
// Curated aliases
// ---------------------------------------------------------------------------

// Known spellings that appear in inventory and on developer sheets but not in
// the catalogue. Each entry is a deliberate, reviewed decision — this is the
// only route by which an inexact name earns a trusted match. Keys and values
// are matched after normalization, so casing and punctuation here are cosmetic.
const ALIASES: Record<string, string> = {
  // Inventory seed spells this with a double "a".
  "hay al wafaa": "Hay Al Wafa",
  // Inventory shortens the catalogue's "Yenaier Residences / Hay Al We'am".
  yenaire: "Yenaier Residences / Hay Al We'am",
  yenaier: "Yenaier Residences / Hay Al We'am",
  "hay al weam": "Yenaier Residences / Hay Al We'am",
  // The catalogue pairs two Muriya destinations under one record.
  "jebel sifah": "Jebel Sifah / Hawana Salalah",
  "hawana salalah": "Jebel Sifah / Hawana Salalah",
  // Commonly written without the emirate-style suffix.
  "al mouj": "Al Mouj Muscat",
  "the pearl": "Golf Hills / The Pearl",
  "golf hills": "Golf Hills / The Pearl",
  "sustainable city yiti": "The Sustainable City — Yiti",
  "sustainable city": "The Sustainable City — Yiti",
  "mandarin oriental": "Residences at Mandarin Oriental",
};

// Generic words that carry no identity — dropped before comparison so that
// "Yenaier Residences" and "Yenaier" reduce to the same key.
const NOISE = new Set([
  "the",
  "project",
  "projects",
  "residences",
  "residence",
  "development",
  "developments",
  "community",
  "muscat",
  "oman",
  "phase",
]);

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Reduce a project name to a comparable key: strip diacritics and punctuation,
 * lowercase, drop noise words, collapse whitespace.
 * "The Sustainable City — Yiti" -> "sustainable city yiti"
 */
export function normalizeProjectName(name: string): string {
  const stripped = name
    .normalize("NFD")
    // Combining marks — Arabic and Latin diacritics alike.
    .replace(/[\u0300-\u036f\u064b-\u0652]/g, "")
    .toLowerCase()
    // Apostrophes join their neighbours ("We'am" -> "weam"); every other
    // separator becomes a space.
    .replace(/['\u2018\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const words = stripped.split(/\s+/).filter((w) => w && !NOISE.has(w));
  // If a name is made *entirely* of noise words, keep it rather than returning
  // an empty key that would match everything.
  return (words.length ? words : stripped.split(/\s+/).filter(Boolean)).join(" ");
}

/** Collapse to letters+digits only, for distance comparison. */
function compact(normalized: string): string {
  return normalized.replace(/ /g, "");
}

/**
 * A catalogue name may pair two destinations ("Jebel Sifah / Hawana Salalah").
 * Yield the whole name plus each side, so either half can match.
 */
function candidateKeys(name: string): string[] {
  const keys = [normalizeProjectName(name)];
  if (name.includes("/")) {
    for (const part of name.split("/")) {
      const k = normalizeProjectName(part);
      if (k && !keys.includes(k)) keys.push(k);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Edit distance
// ---------------------------------------------------------------------------

/**
 * Levenshtein distance, abandoned once it provably exceeds `max` (returns
 * max + 1). Bounding keeps unrelated names cheap and, more importantly, keeps
 * the fuzzy tier narrow.
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    // Every remaining cell can only grow, so no result can beat rowMin.
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Distance budget: tight for short names, a little slack for long ones. */
function budgetFor(len: number): number {
  if (len <= 6) return 1;
  if (len <= 12) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// resolveProject
// ---------------------------------------------------------------------------

const NOT_FOUND: ResolvedProject = {
  project: null,
  confidence: "none",
  trusted: false,
  normalizedQuery: "",
};

/**
 * Find the master-plan record for a project name.
 *
 * Matching runs in trust order and stops at the first hit:
 *   1. exact  — normalized query equals a catalogue key (or one side of a paired name)
 *   2. alias  — the query is a curated spelling in ALIASES
 *   3. fuzzy  — within a small edit distance, reported but NOT trusted
 *
 * A `fuzzy` result is returned so the UI can say "did you mean…", but
 * `trusted` is false and `eligibilityOf` will refuse to derive ownership from it.
 */
export function resolveProject(projectName: string, catalogue: readonly ProjectRef[]): ResolvedProject {
  const query = normalizeProjectName(projectName ?? "");
  if (!query) return NOT_FOUND;

  // 1. Exact, including either half of a paired catalogue name.
  for (const p of catalogue) {
    if (candidateKeys(p.name).includes(query)) {
      return { project: p, confidence: "exact", trusted: true, normalizedQuery: query };
    }
  }

  // 2. Curated alias — resolve the target, then locate it in the catalogue.
  const aliasTarget = ALIASES[query];
  if (aliasTarget) {
    const target = normalizeProjectName(aliasTarget);
    const hit = catalogue.find((p) => candidateKeys(p.name).includes(target));
    if (hit) return { project: hit, confidence: "alias", trusted: true, normalizedQuery: query };
  }

  // 3. Fuzzy — nearest catalogue key within budget. Untrusted by construction.
  const q = compact(query);
  let best: ProjectRef | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const p of catalogue) {
    for (const key of candidateKeys(p.name)) {
      const k = compact(key);
      const budget = budgetFor(Math.min(q.length, k.length));
      const dist = boundedEditDistance(q, k, budget);
      if (dist <= budget && dist < bestDistance) {
        best = p;
        bestDistance = dist;
      }
    }
  }

  if (best) return { project: best, confidence: "fuzzy", trusted: false, normalizedQuery: query };
  return { ...NOT_FOUND, normalizedQuery: query };
}

/**
 * The ownership rule to apply for a resolved project.
 *
 * Returns `unknown` whenever the match is not trusted — an unmatched or merely
 * fuzzy project must never be advertised as foreign-eligible on the strength of
 * a guess. Callers treat `unknown` exactly as they treat `gcc_omani_only`.
 */
export function eligibilityOf(resolved: ResolvedProject): ResolvedEligibility {
  if (!resolved.trusted || !resolved.project) return "unknown";
  return resolved.project.ownershipEligibility;
}

/**
 * Whether a listing for this project may make foreign-ownership and
 * Golden/Investor Residency claims. True only for a trusted ITC match.
 */
export function foreignOwnershipAllowed(resolved: ResolvedProject): boolean {
  return eligibilityOf(resolved) === "all_nationalities";
}
