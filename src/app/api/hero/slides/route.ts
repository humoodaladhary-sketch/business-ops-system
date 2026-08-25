// Hero-slide management: list / create / update / archive. ADMIN only — the
// hero is the most visible surface in the business, so publication is a
// deliberate, audited act. A slide referencing an image can only be
// published when that image is approved and hero-licensed.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "@/app/_departments/config";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Slide = z.object({
  id: z.string().uuid().optional(),
  contentType: z.enum([
    "market_news",
    "featured_property",
    "featured_project",
    "investment_opportunity",
    "new_inventory",
    "oman_update",
    "announcement",
    "collection_priority",
    "campaign",
  ]),
  eyebrow: z.string().max(120).nullable().optional(),
  title: z.string().min(3).max(200),
  description: z.string().max(500).nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
  primaryLabel: z.string().max(60).nullable().optional(),
  primaryHref: z.string().max(600).nullable().optional(),
  secondaryLabel: z.string().max(60).nullable().optional(),
  secondaryHref: z.string().max(600).nullable().optional(),
  sourceLabel: z.string().max(120).nullable().optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.number().int().min(0).max(999).default(100),
  pinned: z.boolean().default(false),
  audience: z.enum(["all", "admin", "agents"]).default("all"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export async function GET() {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true, slides: [] });
  const { data, error } = await db
    .from("hero_slides")
    .select("*")
    .eq("organization_id", ORG_ID)
    .neq("status", "archived")
    .order("pinned", { ascending: false })
    .order("priority")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "list_failed", detail: error.message.slice(0, 200) });
  return NextResponse.json({ slides: data ?? [] });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) {
    return NextResponse.json({ error: "Only admins can manage hero slides." }, { status: 403 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const parsed = Slide.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", detail: parsed.error.issues[0]?.message?.slice(0, 200) },
      { status: 400 },
    );
  }
  const p = parsed.data;

  if (p.startsAt && p.endsAt && Date.parse(p.endsAt) <= Date.parse(p.startsAt)) {
    return NextResponse.json({ error: "bad_request", detail: "end date must be after start" }, { status: 400 });
  }

  // Publishing with an image demands the image be approved + hero-licensed.
  if (p.status === "published" && p.fileId) {
    const { data: asset } = await db
      .from("files")
      .select("approval_status,license_allows_hero,alt_text")
      .eq("organization_id", ORG_ID)
      .eq("id", p.fileId)
      .maybeSingle();
    if (!asset) return NextResponse.json({ error: "image_not_found" }, { status: 422 });
    if (asset.approval_status !== "approved" || !asset.license_allows_hero || !asset.alt_text) {
      return NextResponse.json(
        {
          error: "image_not_publishable",
          detail: "The image must be approved, hero-licensed and carry alt text before the slide can publish.",
        },
        { status: 422 },
      );
    }
  }

  const row = {
    organization_id: ORG_ID,
    content_type: p.contentType,
    eyebrow: p.eyebrow ?? null,
    title: p.title,
    description: p.description ?? null,
    file_id: p.fileId ?? null,
    primary_label: p.primaryLabel ?? null,
    primary_href: p.primaryHref ?? null,
    secondary_label: p.secondaryLabel ?? null,
    secondary_href: p.secondaryHref ?? null,
    source_label: p.sourceLabel ?? null,
    starts_at: p.startsAt ?? null,
    ends_at: p.endsAt ?? null,
    priority: p.priority,
    pinned: p.pinned,
    audience: p.audience,
    status: p.status,
  };

  const query = p.id
    ? db.from("hero_slides").update(row).eq("organization_id", ORG_ID).eq("id", p.id).select("id,status").single()
    : db.from("hero_slides").insert(row).select("id,status").single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "save_failed", detail: error.message.slice(0, 200) });

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: p.id
            ? p.status === "published"
              ? "hero.slide.published"
              : "hero.slide.updated"
            : "hero.slide.created",
          entity: "HeroSlide",
          entityId: data.id,
          after: { title: p.title, status: p.status, contentType: p.contentType } as never,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }
  return NextResponse.json({ saved: data });
}

const Archive = z.object({ id: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });
  const parsed = Archive.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { error } = await db
    .from("hero_slides")
    .update({ status: "archived" })
    .eq("organization_id", ORG_ID)
    .eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "archive_failed", detail: error.message.slice(0, 200) });
  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: "hero.slide.archived",
          entity: "HeroSlide",
          entityId: parsed.data.id,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }
  return NextResponse.json({ archived: true });
}
