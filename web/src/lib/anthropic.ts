/**
 * Claude API wrapper. Every call uses:
 *   - model: claude-opus-4-7
 *   - thinking: adaptive
 *   - system: SYSTEM_PROMPT with cache_control ephemeral (big win on repeated calls)
 *
 * Exposes a small helper set:
 *   - runJson()       → one-shot JSON response
 *   - runVision()     → multi-image vision
 *   - runWithSearch() → market research with web_search tool (future use)
 */

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompts/_system";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = "claude-opus-4-7";

const systemBlocks: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" },
  },
];

function extractFirstJson<T = unknown>(text: string): T {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = t.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    if (t[i] === "{") depth++;
    else if (t[i] === "}") {
      depth--;
      if (depth === 0) return JSON.parse(t.slice(start, i + 1)) as T;
    }
  }
  throw new Error("Unbalanced JSON in response");
}

export async function runJson<T = unknown>(args: {
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ data: T; usage: Anthropic.Messages.Usage }> {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 16_000,
    thinking: { type: "adaptive" },
    system: systemBlocks,
    messages: [{ role: "user", content: args.userPrompt }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { data: extractFirstJson<T>(text), usage: resp.usage };
}

export async function runVision<T = unknown>(args: {
  userPrompt: string;
  images: Array<{ base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" }>;
  maxTokens?: number;
}): Promise<{ data: T; usage: Anthropic.Messages.Usage }> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: args.userPrompt },
    ...args.images.map<Anthropic.ImageBlockParam>((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    })),
  ];

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 8_000,
    thinking: { type: "adaptive" },
    system: systemBlocks,
    messages: [{ role: "user", content }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { data: extractFirstJson<T>(text), usage: resp.usage };
}
