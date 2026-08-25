// AI narrative runner for investment reports. Mirrors src/lib/copilot.ts:
// raw fetch to the Anthropic Messages API, credential from the environment,
// non-streaming, ChatResult-style union. The model receives ONLY the
// deterministic engine's structured result — it explains figures, it never
// computes or invents them.
import type { InvestmentAnalysisResult } from "@/domain/realestate/investment/analyze";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export type NarrativeResult =
  | { ok: true; narrative: string; model: string }
  | { setup: true; reason?: string }
  | { error: string; detail?: string; status?: number };

export type NarrativeAudience = "internal" | "client";
export type NarrativeLanguage = "en" | "ar";

const GUARDRAILS = `You are the investment-report writer for Alwalaa Real Estate (Muscat, Oman — ITC freehold specialists). You receive ONE structured JSON analysis produced by a deterministic calculation engine.

HARD RULES — violating any of these makes the report unusable:
- Use ONLY figures present in the JSON. Never compute, extrapolate, or invent a number, comparable, or market fact. If a figure is null or absent, say the data is missing.
- Projections in the JSON are ASSUMPTION-DRIVEN ILLUSTRATIONS. Never present them as forecasts or guarantees. Never guarantee returns, occupancy, appreciation, or resale.
- Clearly separate verified data from assumptions (the dataQuality section tells you which is which).
- The offerRecommendation (when present) is an analytical estimate from the entered assumptions — say so; it is not a market valuation.
- Mark recommendations as lower-confidence when qualification.confidence is "low" or dataQuality.score is below 50.
- No legal, tax, immigration, or regulated financial advice. Residency notes must repeat that final eligibility rests with the Royal Oman Police.
- Never fabricate legal rules, government fees, or comparable transactions.
- Money is OMR. Write numbers exactly as they appear in the JSON (you may round for readability, saying so).`;

const SECTIONS_INTERNAL = `Write the INTERNAL agent-facing report in Markdown with these sections:
1. Executive summary (3-5 sentences: the deal, the verdict, the one thing that decides it)
2. Qualification & deal score (status, score, criteria passed/failed with distances, confidence)
3. Rental-strategy comparison (only strategies present in the JSON)
4. Key metrics table
5. Multi-year outlook (cash-flow shape, exit, IRR/NPV — as illustrations)
6. Offer & negotiation guidance (asking vs justified vs opening; walk-away; expected metrics at each price)
7. Risks & sensitivities (which variables move the deal most, from sensitivity.ranked)
8. Missing data & what to verify next (from dataQuality + qualification.missingData)
9. Assumptions register (state the key entered assumptions)`;

const SECTIONS_CLIENT = `Write the CLIENT-facing report in Markdown with these sections:
1. Executive summary (plain language, warm but factual)
2. The property (facts from the JSON)
3. What your money buys (acquisition cost breakdown)
4. Income scenarios (rental strategies present in the JSON, as illustrations)
5. Key figures (yields, cash flow — clearly labeled as assumption-based)
6. Multi-year illustration (hold period, exit illustration — never a promise)
7. Risks and what could change the picture
8. What we still need to confirm (missing data)
9. Assumptions and disclaimer

EXCLUDE COMPLETELY: negotiation strategy, opening-offer/walk-away figures, internal scoring mechanics, and anything in an "offer" object. The disclaimer must state figures are illustrative assumptions, not guaranteed returns, and that residency decisions rest with the Royal Oman Police.`;

/** Strips negotiation strategy and internal caveats before a client narrative. */
export function clientSafeResult(result: InvestmentAnalysisResult): Omit<InvestmentAnalysisResult, "offer" | "warnings"> {
  const { offer: _offer, warnings: _warnings, ...safe } = result;
  return safe;
}

export async function generateNarrative(
  result: InvestmentAnalysisResult,
  audience: NarrativeAudience,
  language: NarrativeLanguage = "en",
): Promise<NarrativeResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { setup: true, reason: "Add ANTHROPIC_API_KEY in Vercel to enable AI reports." };
  }

  const payload = audience === "client" ? clientSafeResult(result) : result;
  const sections = audience === "client" ? SECTIONS_CLIENT : SECTIONS_INTERNAL;
  const lang =
    language === "ar"
      ? "Write the report in Modern Standard Arabic (العربية). Keep numerals Western (1234.5) and currency as OMR / ر.ع."
      : "Write the report in English.";

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2400,
        system: `${GUARDRAILS}\n\n${sections}\n\n${lang}`,
        messages: [
          {
            role: "user",
            content: `Structured analysis JSON (the ONLY source of figures):\n\n${JSON.stringify(payload)}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      return { error: "anthropic", status: res.status, detail };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return { error: "empty_response" };
    return { ok: true, narrative: text, model: MODEL };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: "narrative_failed", detail: msg.slice(0, 200) };
  }
}
