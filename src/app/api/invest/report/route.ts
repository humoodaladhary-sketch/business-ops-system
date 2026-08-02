// AI narrative for a saved investment analysis. The model narrates the stored
// deterministic result — it never receives raw inputs to recompute, and the
// client-safe variant is generated from a result with negotiation strategy
// stripped BEFORE the model sees it. Simple in-memory rate limit protects the
// upstream API from runaway clients.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { generateNarrative } from "@/lib/investReport";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";
import type { InvestmentAnalysisResult } from "@/domain/realestate/investment/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  id: z.string().uuid(),
  audience: z.enum(["internal", "client"]),
  language: z.enum(["en", "ar"]).default("en"),
});

// 6 narrative generations per minute per server instance — generous for the
// owner-only app, tight enough to stop a stuck client hammering Anthropic.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
let recentCalls: number[] = [];

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { id, audience, language } = parsed.data;

  const now = Date.now();
  recentCalls = recentCalls.filter((t) => now - t < WINDOW_MS);
  if (recentCalls.length >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "rate_limited", detail: "Try again in a minute." }, { status: 429 });
  }
  recentCalls.push(now);

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true, reason: "Storage is not configured." });

  const { data: row, error } = await db
    .from("investment_analyses")
    .select("id,result")
    .eq("organization_id", ORG_ID)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "load_failed", detail: error.message.slice(0, 200) });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const outcome = await generateNarrative(
    row.result as InvestmentAnalysisResult,
    audience,
    language,
  );
  if (!("ok" in outcome)) {
    console.error(`[invest] narrative ${JSON.stringify({ ...outcome, detail: undefined })}`);
    return NextResponse.json(outcome);
  }

  // Persist the narrative beside the result it narrates.
  const column = audience === "client" ? "narrative_client" : "narrative_internal";
  const { error: saveErr } = await db
    .from("investment_analyses")
    .update({
      [column]: outcome.narrative,
      narrative_model: outcome.model,
      narrative_at: new Date().toISOString(),
    })
    .eq("organization_id", ORG_ID)
    .eq("id", id);
  if (saveErr) {
    // The narrative still goes back to the caller — persistence is best-effort.
    console.error(`[invest] narrative save failed: ${saveErr.message.slice(0, 200)}`);
  }

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: "invest.narrative.generated",
          entity: "InvestmentAnalysis",
          entityId: id,
          after: { audience, language, model: outcome.model } as never,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }

  return NextResponse.json({ ok: true, narrative: outcome.narrative, audience, language });
}
