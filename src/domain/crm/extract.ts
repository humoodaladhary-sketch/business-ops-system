// Auto-extraction from inbound lead messages (C1): language, budget, project.
// Pure + tested; weights/keywords that callers tune live in Settings.

const ARABIC = /[؀-ۿ]/;
export function detectLanguage(text: string | null | undefined): "ar" | "en" {
  return ARABIC.test(String(text ?? "")) ? "ar" : "en";
}

const RESIDENCY_KEYWORDS = [
  "residency", "residence visa", "golden visa", "iqama", "relocat", "move to oman",
  "إقامة", "تأشيرة", "اقامه",
];
export function hasResidencyIntent(text: string | null | undefined): boolean {
  const s = String(text ?? "").toLowerCase();
  return RESIDENCY_KEYWORDS.some((k) => s.includes(k));
}

export interface BudgetMention {
  amount: number; // normalized to the detected currency's units
  currency: "OMR" | "USD" | "AED" | "SAR" | "EUR";
  raw: string;
}

const CUR = /(OMR|USD|AED|SAR|EUR|ر\.?ع|﷼|\$|€)/i;
const CUR_MAP: Record<string, BudgetMention["currency"]> = {
  omr: "OMR", "ر.ع": "OMR", "رع": "OMR", usd: "USD", $: "USD", aed: "AED", sar: "SAR", "﷼": "SAR", eur: "EUR", "€": "EUR",
};

/** Pull a budget figure from free text, e.g. "around 150,000 OMR", "$200k", "budget 1.5m AED". */
export function extractBudget(text: string | null | undefined): BudgetMention | null {
  const s = String(text ?? "");
  const m = s.match(/(OMR|USD|AED|SAR|EUR|\$|€)?\s*([\d][\d.,]*)\s*(k|m|thousand|million|mn)?\s*(OMR|USD|AED|SAR|EUR|\$|€)?/i);
  if (!m) return null;
  const numRaw = m[2];
  if (!numRaw || !/\d/.test(numRaw)) return null;
  let amount = Number(numRaw.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount === 0) return null;
  const mult = (m[3] ?? "").toLowerCase();
  if (mult.startsWith("k") || mult === "thousand") amount *= 1_000;
  else if (mult.startsWith("m")) amount *= 1_000_000;
  const curToken = (m[1] ?? m[4] ?? "").toLowerCase();
  const currency = CUR_MAP[curToken] ?? "OMR";
  // Ignore bare small numbers with no currency and no magnitude (likely not a budget).
  if (!m[1] && !m[4] && !mult && amount < 1000) return null;
  return { amount, currency, raw: m[0].trim() };
}

export interface ProjectRef {
  id: string;
  name: string;
  aliases?: string[];
}

/** First active project whose name/alias appears in the text. */
export function matchProjectInterest(text: string | null | undefined, projects: ProjectRef[]): string | null {
  const s = String(text ?? "").toLowerCase();
  if (!s) return null;
  for (const p of projects) {
    const names = [p.name, ...(p.aliases ?? [])];
    if (names.some((n) => n && s.includes(n.toLowerCase()))) return p.id;
  }
  return null;
}

export { CUR };
