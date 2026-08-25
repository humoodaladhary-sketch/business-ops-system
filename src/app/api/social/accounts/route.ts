// Social account connections — ADMIN only. Tokens go straight into the
// policy-less social_account_secrets table (service-role only) and are never
// returned to any client; the accounts list exposes only status + metadata.
// Connecting runs the platform adapter's read-only verify and records the
// outcome honestly (connected / error + detail).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { ALL_PLATFORMS, PLATFORMS } from "@/domain/social/platforms";
import { publisherFor } from "@/infrastructure/social/publisher";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true, accounts: [] });

  const [{ data: accounts, error }, { data: secrets }] = await Promise.all([
    db
      .from("social_accounts")
      .select("id,platform,handle,display_name,external_account_id,status,status_detail,last_verified_at,created_at")
      .eq("organization_id", ORG_ID)
      .order("platform"),
    db.from("social_account_secrets").select("account_id,token_expires_at"),
  ]);
  if (error) return NextResponse.json({ error: "list_failed", detail: error.message.slice(0, 200) });
  const secretByAccount = new Map((secrets ?? []).map((x) => [x.account_id, x.token_expires_at]));
  return NextResponse.json({
    platforms: ALL_PLATFORMS.map((p) => PLATFORMS[p]),
    accounts: (accounts ?? []).map((a) => ({
      ...a,
      has_token: secretByAccount.has(a.id),
      token_expires_at: secretByAccount.get(a.id) ?? null,
    })),
  });
}

const Connect = z.object({
  id: z.string().uuid().optional(),
  platform: z.enum(["facebook", "instagram", "tiktok", "youtube", "linkedin", "x", "threads", "whatsapp"]),
  handle: z.string().min(1).max(120),
  displayName: z.string().max(160).optional(),
  externalAccountId: z.string().max(160).optional(),
  accessToken: z.string().min(8).max(4000).optional(),
  refreshToken: z.string().max(4000).optional(),
  tokenExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) {
    return NextResponse.json({ error: "Only admins can manage social connections." }, { status: 403 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const parsed = Connect.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", detail: parsed.error.issues[0]?.message?.slice(0, 200) },
      { status: 400 },
    );
  }
  const p = parsed.data;

  // Upsert the account row. Optional identity fields are written ONLY when
  // the caller actually supplied them: a token-only reconnect must never wipe
  // the stored Page/Business ID (which would break verify and publishing).
  const row: Record<string, unknown> = {
    organization_id: ORG_ID,
    platform: p.platform,
    handle: p.handle,
  };
  if (p.displayName !== undefined) row.display_name = p.displayName;
  if (p.externalAccountId !== undefined) row.external_account_id = p.externalAccountId;
  const upsert = p.id
    ? db.from("social_accounts").update(row).eq("organization_id", ORG_ID).eq("id", p.id).select("id").single()
    : db
        .from("social_accounts")
        .upsert(row, { onConflict: "organization_id,platform,handle" })
        .select("id")
        .single();
  const { data: acct, error: upErr } = await upsert;
  if (upErr || !acct) {
    return NextResponse.json({ error: "save_failed", detail: upErr?.message?.slice(0, 200) });
  }

  if (p.accessToken) {
    const { error: secErr } = await db.from("social_account_secrets").upsert({
      account_id: acct.id,
      access_token: p.accessToken,
      refresh_token: p.refreshToken ?? null,
      token_expires_at: p.tokenExpiresAt ?? null,
    });
    if (secErr) return NextResponse.json({ error: "secret_failed", detail: secErr.message.slice(0, 200) });
  }

  // Verify with whatever token AND account id are on file (new or existing) —
  // never with the request body, which may legitimately omit both.
  const [{ data: secret }, { data: stored }] = await Promise.all([
    db.from("social_account_secrets").select("access_token").eq("account_id", acct.id).maybeSingle(),
    db.from("social_accounts").select("external_account_id,display_name").eq("id", acct.id).maybeSingle(),
  ]);

  let status = "disconnected";
  let detail = "No access token on file yet.";
  let accountName: string | undefined;
  if (secret?.access_token) {
    const verify = await publisherFor(p.platform).verify(
      { platform: p.platform, handle: p.handle, externalAccountId: stored?.external_account_id ?? null },
      secret.access_token,
    );
    status = verify.ok ? "connected" : "error";
    detail = verify.detail;
    accountName = verify.accountName;
  }
  await db
    .from("social_accounts")
    .update({
      status,
      status_detail: detail,
      display_name: accountName ?? stored?.display_name ?? null,
      last_verified_at: secret?.access_token ? new Date().toISOString() : null,
    })
    .eq("id", acct.id);

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: status === "connected" ? "social.account.connected" : "social.account.updated",
          entity: "SocialAccount",
          entityId: acct.id,
          after: { platform: p.platform, handle: p.handle, status, detail } as never,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }

  return NextResponse.json({ saved: { id: acct.id, status, detail } });
}

const Disconnect = z.object({ id: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });
  const parsed = Disconnect.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await db.from("social_account_secrets").delete().eq("account_id", parsed.data.id);
  const { error } = await db
    .from("social_accounts")
    .update({ status: "disconnected", status_detail: "Disconnected — token removed." })
    .eq("organization_id", ORG_ID)
    .eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "disconnect_failed", detail: error.message.slice(0, 200) });

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: "social.account.disconnected",
          entity: "SocialAccount",
          entityId: parsed.data.id,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }
  return NextResponse.json({ disconnected: true });
}
