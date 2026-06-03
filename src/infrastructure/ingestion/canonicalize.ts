import type { CanonicalStage } from "@/domain";

// Static dictionaries mirror the seed so adapters can normalize without a DB
// round-trip. The DB-backed DeveloperAlias/ProjectAlias/StageMapping tables are
// the source of truth at runtime; these are the bootstrap/offline copy.

const DEVELOPER_ALIASES: Record<string, string> = {
  "alahly sabbour": "Ahly Sabbour",
  "ahly sabbour": "Ahly Sabbour",
  "ahli sabbur": "Ahly Sabbour",
  "ahly subbour": "Ahly Sabbour",
  "ahli sabbour": "Ahly Sabbour",
  "sarooj development": "Sarooj Development",
  sarooj: "Sarooj Development",
  "sarooj oasis": "Sarooj Development",
  muriya: "Muriya",
  "muriya development": "Muriya",
  alabrar: "Al Abrar",
  "al abrar": "Al Abrar",
  "alabrar real estate": "Al Abrar",
  adante: "Adante Realty",
  "adante realty": "Adante Realty",
};

const PROJECT_ALIASES: Record<string, string> = {
  "wadi zaha": "Wadi Zaha",
  "wadi zaha & yenaier": "Wadi Zaha",
  "hay alwafa": "Hay Al Wafaa",
  "hay alwafaa": "Hay Al Wafaa",
  "hay al wafaa": "Hay Al Wafaa",
  yenair: "Yenaire",
  yenaier: "Yenaire",
  yenaire: "Yenaire",
  "sarooj oasis": "Sarooj Oasis",
  "sarooj osis": "Sarooj Oasis",
  "olive farms": "Olive Farms",
  "olive farms - raya jebel sifah": "Olive Farms",
};

const STAGE_MAP: Record<string, CanonicalStage> = {
  new: "NEW",
  contacted: "QUALIFIED",
  "qualification meeting": "ENGAGED",
  "in progress": "NEGOTIATION",
  pending: "RESERVATION",
  "spa pending": "RESERVATION",
  reserved: "RESERVATION",
  closed: "CLOSED_WON",
  sold: "CLOSED_WON",
  lost: "CLOSED_LOST",
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function canonicalizeDeveloper(raw: unknown, dict = DEVELOPER_ALIASES): string | null {
  return dict[norm(raw)] ?? (norm(raw) ? String(raw).trim() : null);
}

export function canonicalizeProject(raw: unknown, dict = PROJECT_ALIASES): string | null {
  return dict[norm(raw)] ?? (norm(raw) ? String(raw).trim() : null);
}

/** Map a raw stage label to the canonical pipeline; defaults to RESERVATION for
 *  closed-deal rows (callers pass a default appropriate to the source tab). */
export function mapStage(
  raw: unknown,
  fallback: CanonicalStage = "NEGOTIATION",
  map = STAGE_MAP,
): CanonicalStage {
  return map[norm(raw)] ?? fallback;
}
