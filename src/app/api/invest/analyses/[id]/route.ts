// Load / archive a single saved investment analysis.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Id = z.string().uuid();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Id.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const { data, error } = await db
    .from("investment_analyses")
    .select("*")
    .eq("organization_id", ORG_ID)
    .eq("id", id.data)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "load_failed", detail: error.message.slice(0, 200) });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ analysis: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || !isAdmin(s)) {
    return NextResponse.json({ error: "Only admins can archive analyses." }, { status: 403 });
  }
  const id = Id.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const { error } = await db
    .from("investment_analyses")
    .update({ status: "archived" })
    .eq("organization_id", ORG_ID)
    .eq("id", id.data);
  if (error) return NextResponse.json({ error: "archive_failed", detail: error.message.slice(0, 200) });

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: "invest.analysis.archived",
          entity: "InvestmentAnalysis",
          entityId: id.data,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }
  return NextResponse.json({ archived: true });
}
