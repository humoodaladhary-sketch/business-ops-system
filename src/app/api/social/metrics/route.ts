// Social metrics — the dashboard's direct numbers. Two honest sources:
//   refresh — read-only adapter pull (Meta today) per connected account
//   manual  — owner-entered figures for platforms without an adapter yet,
//             stored with source='manual' and always labeled as such
// Snapshots are append-only time series; a refresh within 30 minutes of the
// last API snapshot no-ops (idempotent against button-mashing). Audited.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import type { SocialPlatform } from "@/domain/social/platforms";
import { publisherFor } from "@/infrastructure/social/publisher";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true, metrics: [] });
  const { data, error } = await db
    .from("social_metrics_snapshots")
    .select("account_id,captured_at,followers,posts_count,metrics,source")
    .eq("organization_id", ORG_ID)
    .order("captured_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: "list_failed", detail: error.message.slice(0, 200) });
  return NextResponse.json({ metrics: data ?? [] });
}

const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("refresh"), accountId: z.string().uuid().optional() }),
  z.object({
    mode: z.literal("manual"),
    accountId: z.string().uuid(),
    followers: z.number().int().min(0).max(1_000_000_000),
    postsCount: z.number().int().min(0).max(10_000_000).nullable().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const p = parsed.data;

  if (p.mode === "manual") {
    const { data: owned } = await db
      .from("social_accounts")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("id", p.accountId)
      .maybeSingle();
    if (!owned) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
    const { error } = await db.from("social_metrics_snapshots").insert({
      organization_id: ORG_ID,
      account_id: p.accountId,
      followers: p.followers,
      posts_count: p.postsCount ?? null,
      source: "manual",
    });
    if (error) return NextResponse.json({ error: "save_failed", detail: error.message.slice(0, 200) });
    if (hasDatabase) {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: s.userId,
            actorRole: s.role,
            action: "social.metrics.manual",
            entity: "SocialAccount",
            entityId: p.accountId,
            after: { followers: p.followers, postsCount: p.postsCount ?? null } as never,
          },
        });
      } catch {
        /* audit is best-effort */
      }
    }
    return NextResponse.json({ ok: true, saved: 1 });
  }

  // --- refresh: every connected account (or one), through its adapter -----
  let query = db
    .from("social_accounts")
    .select("id,platform,handle,external_account_id")
    .eq("organization_id", ORG_ID)
    .eq("status", "connected");
  if (p.accountId) query = query.eq("id", p.accountId);
  const { data: accounts } = await query;
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ ok: true, refreshed: 0, detail: "No connected accounts." });
  }

  const results: { accountId: string; ok: boolean; skipped?: boolean; detail: string }[] = [];
  for (const a of accounts) {
    // Cooldown: skip when a fresh API snapshot already exists.
    const { data: last } = await db
      .from("social_metrics_snapshots")
      .select("captured_at")
      .eq("account_id", a.id)
      .eq("source", "api")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - Date.parse(last.captured_at) < REFRESH_COOLDOWN_MS) {
      results.push({ accountId: a.id, ok: true, skipped: true, detail: "already fresh (cooldown)" });
      continue;
    }

    const { data: secret } = await db
      .from("social_account_secrets")
      .select("access_token")
      .eq("account_id", a.id)
      .maybeSingle();
    if (!secret?.access_token) {
      results.push({ accountId: a.id, ok: false, detail: "no token" });
      continue;
    }
    const m = await publisherFor(a.platform as SocialPlatform).fetchMetrics(
      { platform: a.platform as SocialPlatform, handle: a.handle, externalAccountId: a.external_account_id },
      secret.access_token,
    );
    if (!m.ok) {
      results.push({ accountId: a.id, ok: false, detail: m.error ?? "failed" });
      continue;
    }
    const { error: insErr } = await db.from("social_metrics_snapshots").insert({
      organization_id: ORG_ID,
      account_id: a.id,
      followers: m.followers ?? null,
      posts_count: m.postsCount ?? null,
      metrics: m.extra ?? null,
      source: "api",
    });
    results.push({ accountId: a.id, ok: !insErr, detail: insErr ? insErr.message.slice(0, 100) : "ok" });
  }

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: "social.metrics.refreshed",
          entity: "SocialAccount",
          entityId: p.accountId ?? null,
          after: { results } as never,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }
  // Honest reporting: a cooldown skip is not a refresh, and if every account
  // failed the caller must see the platform's actual error, not a green tick.
  const refreshed = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failures = results.filter((r) => !r.ok);
  const summary = [
    `${refreshed} updated`,
    skipped ? `${skipped} already fresh` : null,
    failures.length ? `${failures.length} failed: ${failures.map((f) => f.detail).join("; ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return NextResponse.json({
    ok: failures.length === 0,
    refreshed,
    skipped,
    failed: failures.length,
    detail: summary.slice(0, 400),
    results,
  });
}
