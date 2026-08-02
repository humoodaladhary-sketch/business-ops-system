// Investment analyses: list + save. The server re-runs the deterministic
// engine on the validated input — client-computed figures are never stored.
// Storage is the Supabase system of record (service role, org-scoped); when
// no database key is configured the route degrades to { setup: true } and the
// Invest tab keeps working in-session without persistence.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { runInvestmentAnalysis, FORMULA_VERSION } from "@/domain/realestate/investment/analyze";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";
import { SaveAnalysisSchema } from "../schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIST_COLUMNS =
  "id,title,unit_reference,status,formula_version,analysis_version,narrative_at,created_at,updated_at";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true, analyses: [] });

  const { data, error } = await db
    .from("investment_analyses")
    .select(LIST_COLUMNS)
    .eq("organization_id", ORG_ID)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "list_failed", detail: error.message.slice(0, 200) });
  return NextResponse.json({ analyses: data ?? [] });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = SaveAnalysisSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", detail: parsed.error.issues[0]?.message?.slice(0, 200) },
      { status: 400 },
    );
  }
  const { id, title, status, input } = parsed.data;

  // The engine is the source of truth — recompute server-side.
  let result;
  try {
    result = runInvestmentAnalysis(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "engine_failed", detail: msg.slice(0, 200) }, { status: 422 });
  }

  const db = supabaseAdmin();
  if (!db) {
    // No persistence configured: return the computed result so the client can
    // still render — nothing is stored.
    return NextResponse.json({ setup: true, result });
  }

  try {
    let row;
    if (id) {
      const { data: existing, error: readErr } = await db
        .from("investment_analyses")
        .select("id,analysis_version")
        .eq("organization_id", ORG_ID)
        .eq("id", id)
        .maybeSingle();
      if (readErr || !existing) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      const { data, error } = await db
        .from("investment_analyses")
        .update({
          title,
          status,
          unit_reference: input.property.reference ?? null,
          input,
          result,
          formula_version: FORMULA_VERSION,
          analysis_version: (existing.analysis_version ?? 1) + 1,
        })
        .eq("organization_id", ORG_ID)
        .eq("id", id)
        .select(LIST_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      row = data;
    } else {
      const { data, error } = await db
        .from("investment_analyses")
        .insert({
          organization_id: ORG_ID,
          title,
          status,
          unit_reference: input.property.reference ?? null,
          input,
          result,
          formula_version: FORMULA_VERSION,
        })
        .select(LIST_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      row = data;
    }

    // Audit — never let logging failure roll back the save.
    if (hasDatabase) {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: s.userId,
            actorRole: s.role,
            action: id ? "invest.analysis.resaved" : "invest.analysis.created",
            entity: "InvestmentAnalysis",
            entityId: row.id,
            after: { title, status, unitReference: input.property.reference ?? null } as never,
          },
        });
      } catch {
        /* audit is best-effort */
      }
    }

    return NextResponse.json({ saved: row, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[invest] save failed: ${msg.slice(0, 200)}`);
    return NextResponse.json({ error: "save_failed", detail: msg.slice(0, 200) });
  }
}
