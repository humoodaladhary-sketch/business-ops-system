// Social post drafts — create/update/list. Every draft carries a
// deterministic idempotency key (unique per org), is validated against its
// platform's constraints, and may only reference APPROVED media. Editing
// content resets the post to draft: the dry-run gate must pass again.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { postIdempotencyKey, validatePost } from "@/domain/social/posting";
import type { SocialPlatform } from "@/domain/social/platforms";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true, posts: [] });
  const { data, error } = await db
    .from("social_posts")
    .select(
      "id,account_id,body,link_url,media_file_ids,status,scheduled_at,posted_at,external_post_id,error,dry_run_at,created_at,social_accounts(platform,handle)",
    )
    .eq("organization_id", ORG_ID)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "list_failed", detail: error.message.slice(0, 200) });
  return NextResponse.json({ posts: data ?? [] });
}

const Draft = z.object({
  id: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  body: z.string().max(6000),
  linkUrl: z.string().url().max(600).nullable().optional(),
  mediaFileIds: z.array(z.string().uuid()).max(10).default([]),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) {
    return NextResponse.json({ error: "Only admins can manage posts." }, { status: 403 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const parsed = Draft.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", detail: parsed.error.issues[0]?.message?.slice(0, 200) },
      { status: 400 },
    );
  }
  const p = parsed.data;

  const { data: account } = await db
    .from("social_accounts")
    .select("id,platform,handle")
    .eq("organization_id", ORG_ID)
    .eq("id", p.accountId)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });

  // Platform validation (count-level; media approval is checked at dry run).
  const validation = validatePost({
    platform: account.platform as SocialPlatform,
    accountId: account.id,
    body: p.body,
    linkUrl: p.linkUrl ?? null,
    mediaCount: p.mediaFileIds.length,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: "invalid_post", detail: validation.errors.join("; ") }, { status: 422 });
  }

  const idempotencyKey = postIdempotencyKey({
    accountId: account.id,
    body: p.body,
    linkUrl: p.linkUrl ?? null,
    mediaFileIds: p.mediaFileIds,
  });

  const row = {
    organization_id: ORG_ID,
    account_id: account.id,
    body: p.body,
    link_url: p.linkUrl ?? null,
    media_file_ids: p.mediaFileIds,
    scheduled_at: p.scheduledAt ?? null,
    status: "draft" as const, // any content change re-enters the dry-run gate
    idempotency_key: idempotencyKey,
    dry_run_at: null,
    error: null,
  };

  let saved;
  if (p.id) {
    const { data, error } = await db
      .from("social_posts")
      .update(row)
      .eq("organization_id", ORG_ID)
      .eq("id", p.id)
      .neq("status", "posted") // a published post is immutable history
      .select("id,status")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "save_failed", detail: error.message.slice(0, 200) });
    if (!data) return NextResponse.json({ error: "not_editable" }, { status: 409 });
    saved = data;
  } else {
    const { data, error } = await db
      .from("social_posts")
      .upsert({ ...row, created_by: null }, { onConflict: "organization_id,idempotency_key" })
      .select("id,status")
      .single();
    if (error) return NextResponse.json({ error: "save_failed", detail: error.message.slice(0, 200) });
    saved = data;
  }

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: p.id ? "social.post.updated" : "social.post.drafted",
          entity: "SocialPost",
          entityId: saved.id,
          after: { platform: account.platform, handle: account.handle, idempotencyKey } as never,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }

  return NextResponse.json({ saved, warnings: validation.warnings });
}
