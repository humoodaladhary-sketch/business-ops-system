// AI content generation for the social composer: photos/renders + owner
// brief → platform-tailored captions. The model writes COPY only — every
// fact must come from the brief or the selected media's stored descriptions,
// platform constraints come from the domain registry, and the output is
// drafts for human review in the composer (never auto-published; the
// dry-run → publish gate still applies).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { PLATFORMS, type SocialPlatform } from "@/domain/social/platforms";
import { CLASSIFICATION_LABELS } from "@/domain/media/types";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// 10 generations per minute per instance — stops runaway clients.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
let recentCalls: number[] = [];

const Body = z.object({
  platforms: z
    .array(z.enum(["facebook", "instagram", "tiktok", "youtube", "linkedin", "x", "threads"]))
    .min(1)
    .max(7),
  brief: z.string().min(3).max(4000),
  mediaFileIds: z.array(z.string().uuid()).max(10).default([]),
  language: z.enum(["en", "ar", "both"]).default("en"),
});

const GUARDRAILS = `You write social captions for Alwalaa Real Estate (Muscat, Oman — luxury ITC freehold sold to foreign investors; brand voice: premium, editorial, restrained).

HARD RULES:
- Use ONLY facts given in the brief and the image descriptions. Never invent prices, sizes, availability, yields, dates, or legal/residency claims.
- If the images are renderings or visualizations, the caption must not present them as finished, photographed reality.
- Never guarantee returns or residency outcomes. Residency mentions must stay factual (ITC freehold is open to all nationalities; approval rests with the authorities).
- ITC-only rule for foreign-facing content: never pitch GCC/Omani-only stock to a foreign audience.
- No emojis unless the brief asks for them. Hashtags only where idiomatic for the platform (Instagram/TikTok/Threads: up to 8 relevant; LinkedIn: up to 3; Facebook/X: 0-2).
- Respect each platform's character limit and style given in the user message.

Respond with ONLY a JSON array, no other text:
[{"platform":"instagram","caption":"...","hashtags":["..."],"notes":"one line on why this angle fits the platform"}]`;

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ setup: true, reason: "Add ANTHROPIC_API_KEY to enable generation." });

  const now = Date.now();
  recentCalls = recentCalls.filter((t) => now - t < WINDOW_MS);
  if (recentCalls.length >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "rate_limited", detail: "Try again in a minute." }, { status: 429 });
  }
  recentCalls.push(now);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", detail: parsed.error.issues[0]?.message?.slice(0, 200) },
      { status: 400 },
    );
  }
  const p = parsed.data;

  // Media context: stored alt text / vision captions / classification only —
  // the model hears what the images ARE, from governed metadata.
  let mediaContext = "No images selected.";
  if (p.mediaFileIds.length > 0) {
    const db = supabaseAdmin();
    if (db) {
      const { data: files } = await db
        .from("files")
        .select("id,alt_text,vision_caption,classification,location_label")
        .eq("organization_id", ORG_ID)
        .in("id", p.mediaFileIds);
      mediaContext =
        (files ?? [])
          .map((f, i) => {
            const cls =
              CLASSIFICATION_LABELS[f.classification as keyof typeof CLASSIFICATION_LABELS] ??
              "unclassified image";
            return `Image ${i + 1} (${cls}${f.location_label ? `, ${f.location_label}` : ""}): ${f.alt_text ?? f.vision_caption ?? "no description on file"}`;
          })
          .join("\n") || mediaContext;
    }
  }

  const platformSpecs = p.platforms
    .map((pl) => {
      const spec = PLATFORMS[pl as SocialPlatform];
      return `- ${pl}: max ${spec.maxBodyLength} chars${spec.requiresMedia ? ", image-led" : ""}${spec.supportsLink ? ", links allowed" : ", links do not hyperlink"}`;
    })
    .join("\n");
  const lang =
    p.language === "ar"
      ? "Write captions in Modern Standard Arabic."
      : p.language === "both"
        ? "Write each caption bilingually: English first, then Arabic, separated by a blank line."
        : "Write captions in English.";

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        system: GUARDRAILS,
        messages: [
          {
            role: "user",
            content: `Platforms and constraints:\n${platformSpecs}\n\nOwner brief (the only source of facts):\n${p.brief}\n\nSelected images:\n${mediaContext}\n\n${lang}\nProduce one caption per platform.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json({ error: "anthropic", status: res.status, detail });
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "bad_model_output" });
    let drafts: unknown;
    try {
      drafts = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "bad_model_output" });
    }
    const Draft = z.array(
      z.object({
        platform: z.string(),
        caption: z.string(),
        hashtags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    );
    const validated = Draft.safeParse(drafts);
    if (!validated.success) return NextResponse.json({ error: "bad_model_output" });

    if (hasDatabase) {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: s.userId,
            actorRole: s.role,
            action: "social.content.generated",
            entity: "SocialPost",
            after: { platforms: p.platforms, briefChars: p.brief.length, images: p.mediaFileIds.length } as never,
          },
        });
      } catch {
        /* audit is best-effort */
      }
    }
    return NextResponse.json({ ok: true, drafts: validated.data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "generation_failed", detail: msg.slice(0, 200) });
  }
}
