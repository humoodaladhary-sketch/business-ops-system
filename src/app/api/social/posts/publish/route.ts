// Publish gate for social posts. Two modes, both audited:
//   dry_run — validates everything the live path will need (platform rules,
//             approved media, signed URLs, a read-only token verification)
//             and marks the post dry_run_ok. NO write call leaves the OS.
//   live    — allowed ONLY from dry_run_ok (state machine), guarded against
//             double-posting by the idempotency key + a compare-and-set
//             status transition, then performs the real platform post.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { canPublishLive } from "@/domain/social/posting";
import type { SocialPlatform } from "@/domain/social/platforms";
import { publisherFor } from "@/infrastructure/social/publisher";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "alwalaa";
const SIGNED_TTL = 3600; // IG fetches the image after we hand over the URL

const Body = z.object({
  id: z.string().uuid(),
  mode: z.enum(["dry_run", "live"]),
});

async function audit(actor: { userId: string; role: string }, action: string, id: string, after?: object) {
  if (!hasDatabase) return;
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        action,
        entity: "SocialPost",
        entityId: id,
        after: (after ?? undefined) as never,
      },
    });
  } catch {
    /* audit is best-effort */
  }
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) {
    return NextResponse.json({ error: "Only admins can publish." }, { status: 403 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { id, mode } = parsed.data;

  const { data: post } = await db
    .from("social_posts")
    .select("*")
    .eq("organization_id", ORG_ID)
    .eq("id", id)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Idempotency: an already-posted post never posts again.
  if (post.status === "posted") {
    return NextResponse.json({
      ok: true,
      alreadyPosted: true,
      externalPostId: post.external_post_id,
    });
  }

  const { data: account } = await db
    .from("social_accounts")
    .select("id,platform,handle,external_account_id,status")
    .eq("id", post.account_id)
    .maybeSingle();
  if (!account) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  const platform = account.platform as SocialPlatform;

  const { data: secret } = await db
    .from("social_account_secrets")
    .select("access_token,token_expires_at")
    .eq("account_id", account.id)
    .maybeSingle();
  if (!secret?.access_token) {
    return NextResponse.json({ error: "no_token", detail: "Connect the account first." }, { status: 422 });
  }
  if (secret.token_expires_at && Date.parse(secret.token_expires_at) < Date.now()) {
    return NextResponse.json({ error: "token_expired", detail: "Refresh the access token." }, { status: 422 });
  }

  // Media must be approved + publicly licensed; sign fresh URLs.
  const mediaIds: string[] = post.media_file_ids ?? [];
  let imageUrls: string[] = [];
  if (mediaIds.length > 0) {
    const { data: files } = await db
      .from("files")
      .select("id,storage_path,approval_status,license_allows_hero,alt_text")
      .in("id", mediaIds);
    const byId = new Map((files ?? []).map((f) => [f.id, f]));
    const problems: string[] = [];
    for (const mid of mediaIds) {
      const f = byId.get(mid);
      if (!f) problems.push(`media ${mid.slice(0, 8)} not found`);
      else if (f.approval_status !== "approved" || !f.license_allows_hero)
        problems.push(`media ${mid.slice(0, 8)} is not approved for public use`);
    }
    if (problems.length > 0) {
      return NextResponse.json({ error: "media_not_publishable", detail: problems.join("; ") }, { status: 422 });
    }
    const paths = mediaIds.map((mid) => byId.get(mid)!.storage_path);
    const { data: signed } = await db.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
    imageUrls = (signed ?? []).filter((e) => e.signedUrl && !e.error).map((e) => e.signedUrl as string);
    if (imageUrls.length !== mediaIds.length) {
      return NextResponse.json({ error: "media_sign_failed" }, { status: 422 });
    }
  }

  const publisher = publisherFor(platform);
  const accountRef = {
    platform,
    handle: account.handle,
    externalAccountId: account.external_account_id,
  };

  if (mode === "dry_run") {
    const verify = await publisher.verify(accountRef, secret.access_token);
    if (!verify.ok) {
      await db.from("social_posts").update({ error: verify.detail }).eq("id", id);
      await audit(s, "social.post.dry_run_failed", id, { detail: verify.detail });
      return NextResponse.json({ ok: false, detail: verify.detail });
    }
    await db
      .from("social_posts")
      .update({ status: "dry_run_ok", dry_run_at: new Date().toISOString(), error: null })
      .eq("id", id);
    await audit(s, "social.post.dry_run", id, { platform, images: imageUrls.length });
    return NextResponse.json({
      ok: true,
      wouldPost: {
        platform,
        handle: account.handle,
        verifiedAs: verify.accountName ?? account.handle,
        bodyPreview: String(post.body).slice(0, 280),
        images: imageUrls.length,
        link: post.link_url ?? null,
      },
    });
  }

  // ---- live ----
  if (!canPublishLive(post.status)) {
    return NextResponse.json(
      { error: "dry_run_required", detail: `Post is '${post.status}' — run a successful dry run first.` },
      { status: 409 },
    );
  }
  // Compare-and-set: only one caller wins the transition to 'posting'.
  const { data: claimed } = await db
    .from("social_posts")
    .update({ status: "posting" })
    .eq("id", id)
    .eq("status", "dry_run_ok")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json({ error: "conflict", detail: "Post is already being published." }, { status: 409 });
  }

  const result = await publisher.publish({
    account: accountRef,
    accessToken: secret.access_token,
    body: post.body,
    linkUrl: post.link_url,
    imageUrls,
  });

  if (result.ok) {
    await db
      .from("social_posts")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        external_post_id: result.externalPostId ?? null,
        error: null,
      })
      .eq("id", id);
    await audit(s, "social.post.published", id, {
      platform,
      handle: account.handle,
      externalPostId: result.externalPostId,
    });
    return NextResponse.json({ ok: true, externalPostId: result.externalPostId });
  }

  await db.from("social_posts").update({ status: "failed", error: result.error ?? "unknown" }).eq("id", id);
  await audit(s, "social.post.failed", id, { platform, error: result.error });
  return NextResponse.json({ ok: false, error: result.error });
}
