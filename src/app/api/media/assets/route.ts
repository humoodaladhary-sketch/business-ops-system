// Media library: list assets with signed preview URLs, and update governance
// metadata (approve/reject, focal point, alt text, attribution,
// classification, license flags). ADMIN only — approval is the publication
// gate for every image surface.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/infrastructure/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MEDIA_BUCKET } from "@/lib/storage";
import { ORG_ID } from "@/app/_departments/config";
import { validateAltText } from "@/domain/media/upload";
import { prisma, hasDatabase } from "@/infrastructure/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET() {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true, assets: [] });

  const { data, error } = await db
    .from("files")
    .select(
      "id,storage_path,filename,kind,project_id,unit_id,mime_type,source_type,owner_name,license_type,license_allows_hero,license_allows_reports,attribution,classification,approval_status,alt_text,focal_x,focal_y,width_px,height_px,dominant_color,location_label,created_at",
    )
    .eq("organization_id", ORG_ID)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) {
    return NextResponse.json({ error: "list_failed", detail: error?.message?.slice(0, 200) });
  }
  const paths = data.map((r) => r.storage_path as string);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 1800);
    (signed ?? []).forEach((e, i) => {
      if (e.signedUrl && !e.error) urlByPath.set(paths[i], e.signedUrl);
    });
  }
  return NextResponse.json({
    assets: data.map((r) => ({ ...r, preview_url: urlByPath.get(r.storage_path as string) ?? null })),
  });
}

const Patch = z.object({
  id: z.string().uuid(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  altText: z.string().max(400).optional(),
  attribution: z.string().max(300).nullable().optional(),
  classification: z
    .enum(["photo", "developer_render", "arch_visualization", "concept", "stock", "branded_graphic"])
    .optional(),
  licenseAllowsHero: z.boolean().optional(),
  licenseAllowsReports: z.boolean().optional(),
  focalX: z.number().min(0).max(1).nullable().optional(),
  focalY: z.number().min(0).max(1).nullable().optional(),
  focalXMobile: z.number().min(0).max(1).nullable().optional(),
  focalYMobile: z.number().min(0).max(1).nullable().optional(),
  kind: z.enum(["inventory", "render", "hero_general", "location", "other"]).optional(),
  locationLabel: z.string().max(120).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s || !isAdmin(s)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ setup: true });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const p = parsed.data;

  // Approving an image requires publishable alt text — enforce at the gate.
  if (p.approvalStatus === "approved" && p.altText !== undefined) {
    const alt = validateAltText(p.altText);
    if (!alt.ok) return NextResponse.json({ error: "invalid_alt", detail: alt.reason }, { status: 422 });
  }

  const update: Record<string, unknown> = {};
  if (p.approvalStatus !== undefined) update.approval_status = p.approvalStatus;
  if (p.altText !== undefined) update.alt_text = p.altText;
  if (p.attribution !== undefined) update.attribution = p.attribution;
  if (p.classification !== undefined) update.classification = p.classification;
  if (p.licenseAllowsHero !== undefined) update.license_allows_hero = p.licenseAllowsHero;
  if (p.licenseAllowsReports !== undefined) update.license_allows_reports = p.licenseAllowsReports;
  if (p.focalX !== undefined) update.focal_x = p.focalX;
  if (p.focalY !== undefined) update.focal_y = p.focalY;
  if (p.focalXMobile !== undefined) update.focal_x_mobile = p.focalXMobile;
  if (p.focalYMobile !== undefined) update.focal_y_mobile = p.focalYMobile;
  if (p.kind !== undefined) update.kind = p.kind;
  if (p.locationLabel !== undefined) update.location_label = p.locationLabel;
  if (p.approvalStatus === "approved") update.last_verified_at = new Date().toISOString();

  const { error } = await db.from("files").update(update).eq("organization_id", ORG_ID).eq("id", p.id);
  if (error) return NextResponse.json({ error: "update_failed", detail: error.message.slice(0, 200) });

  if (hasDatabase) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: s.userId,
          actorRole: s.role,
          action:
            p.approvalStatus === "approved"
              ? "media.approved"
              : p.approvalStatus === "rejected"
                ? "media.rejected"
                : "media.updated",
          entity: "MediaAsset",
          entityId: p.id,
          after: update as never,
        },
      });
    } catch {
      /* audit is best-effort */
    }
  }
  return NextResponse.json({ updated: true });
}
