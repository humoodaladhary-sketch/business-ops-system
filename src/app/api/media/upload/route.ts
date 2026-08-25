// Banner/media upload — ADMIN only. Validates type/size/dimensions server-
// side (the pure rules in @/domain/media/upload), stores the original in the
// PRIVATE 'alwalaa' bucket under media/, and writes the governance metadata
// row. Nothing is auto-published: approval is an explicit flag the admin
// sets, and the license fields must be attested at upload time.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/storage";
import { ORG_ID } from "@/app/_departments/config";
import { validateAltText, validateUpload } from "@/domain/media/upload";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


const Meta = z.object({
  altText: z.string().min(1).max(400),
  classification: z.enum([
    "photo",
    "developer_render",
    "arch_visualization",
    "concept",
    "stock",
    "branded_graphic",
  ]),
  sourceType: z.enum([
    "alwalaa_owned",
    "inventory",
    "upload",
    "developer",
    "news_source",
    "licensed_stock",
    "branded",
  ]),
  licenseType: z.enum(["owned", "developer_approved", "editorial", "royalty_free", "rights_managed"]),
  licenseAllowsHero: z.boolean(),
  licenseAllowsReports: z.boolean(),
  ownerName: z.string().max(200).optional(),
  attribution: z.string().max(300).optional(),
  sourceUrl: z.string().url().max(600).optional(),
  projectId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  kind: z.enum(["inventory", "render", "hero_general", "location", "other"]).default("other"),
  locationLabel: z.string().max(120).optional(),
  widthPx: z.number().int().min(1).max(20000).optional(),
  heightPx: z.number().int().min(1).max(20000).optional(),
  blurDataUrl: z.string().max(6000).startsWith("data:image/").optional(),
  dominantColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
  approve: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) {
    return NextResponse.json({ error: "Only admins can upload media." }, { status: 403 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const file = form.get("file");
  const metaRaw = form.get("meta");
  if (!(file instanceof File) || typeof metaRaw !== "string") {
    return NextResponse.json({ error: "bad_request", detail: "file + meta required" }, { status: 400 });
  }
  const meta = Meta.safeParse(JSON.parse(metaRaw));
  if (!meta.success) {
    return NextResponse.json(
      { error: "bad_request", detail: meta.error.issues[0]?.message?.slice(0, 200) },
      { status: 400 },
    );
  }
  const m = meta.data;

  const validation = validateUpload({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    widthPx: m.widthPx,
    heightPx: m.heightPx,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: "invalid_image", detail: validation.errors.join("; ") }, { status: 422 });
  }
  const alt = validateAltText(m.altText);
  if (!alt.ok) {
    return NextResponse.json({ error: "invalid_alt", detail: alt.reason }, { status: 422 });
  }

  const storagePath = `media/${Date.now().toString(36)}-${validation.safeName}`;
  const bytes = await file.arrayBuffer();
  const { error: upErr } = await db.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: "storage_failed", detail: upErr.message.slice(0, 200) });
  }

  const { data: row, error: insErr } = await db
    .from("files")
    .insert({
      organization_id: ORG_ID,
      project_id: m.projectId ?? null,
      unit_id: m.unitId ?? null,
      storage_path: storagePath,
      filename: validation.safeName,
      mime_type: file.type,
      size_bytes: file.size,
      kind: m.kind,
      source_type: m.sourceType,
      source_url: m.sourceUrl ?? null,
      owner_name: m.ownerName ?? null,
      license_type: m.licenseType,
      license_allows_hero: m.licenseAllowsHero,
      license_allows_reports: m.licenseAllowsReports,
      attribution: m.attribution ?? null,
      classification: m.classification,
      approval_status: m.approve ? "approved" : "pending",
      alt_text: m.altText,
      focal_x: m.focalX ?? null,
      focal_y: m.focalY ?? null,
      width_px: m.widthPx ?? null,
      height_px: m.heightPx ?? null,
      blur_data_url: m.blurDataUrl ?? null,
      dominant_color: m.dominantColor ?? null,
      location_label: m.locationLabel ?? null,
      last_verified_at: new Date().toISOString(),
    })
    .select("id,storage_path,approval_status")
    .single();
  if (insErr) {
    // Roll the object back so storage never holds unreferenced media.
    await db.storage.from(MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
    return NextResponse.json({ error: "insert_failed", detail: insErr.message.slice(0, 200) });
  }

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action: "media.uploaded",
          entity: "MediaAsset",
          entityId: row.id,
          after: {
            storagePath,
            classification: m.classification,
            licenseType: m.licenseType,
            approved: m.approve,
          } as never,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }

  return NextResponse.json({ uploaded: row });
}
