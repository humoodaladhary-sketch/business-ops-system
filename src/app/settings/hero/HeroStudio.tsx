"use client";

// Admin studio for the Command Portal hero: slide editor (schedule, pin,
// priority, audience, actions, image) + media library (upload with client-
// side dimension/blur/dominant-color extraction, approve/reject, focal point
// by clicking the preview, alt text, classification, license flags).
/* eslint-disable @next/next/no-img-element -- previews use short-lived signed
   URLs with dynamic dimensions; the optimizer pipeline is for the portal. */
import { useCallback, useEffect, useState } from "react";
import { Check, ImagePlus, Pin, RefreshCw, Trash2, X } from "lucide-react";
import { Card } from "../../components/ui";
import { cn } from "../../lib/cn";

const FIELD =
  "w-full rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";
const LABEL = "mb-1 block text-[11px] uppercase tracking-wide text-white/45";

interface AssetRow {
  id: string;
  storage_path: string;
  filename: string;
  kind: string | null;
  classification: string | null;
  approval_status: string;
  alt_text: string | null;
  attribution: string | null;
  license_type: string | null;
  license_allows_hero: boolean;
  license_allows_reports: boolean;
  focal_x: number | null;
  focal_y: number | null;
  width_px: number | null;
  height_px: number | null;
  location_label: string | null;
  preview_url: string | null;
}

interface SlideRow {
  id: string;
  content_type: string;
  eyebrow: string | null;
  title: string;
  description: string | null;
  file_id: string | null;
  primary_label: string | null;
  primary_href: string | null;
  secondary_label: string | null;
  secondary_href: string | null;
  source_label: string | null;
  starts_at: string | null;
  ends_at: string | null;
  priority: number;
  pinned: boolean;
  audience: string;
  status: string;
}

const CONTENT_TYPES = [
  ["market_news", "Market news"],
  ["featured_property", "Featured property"],
  ["featured_project", "Featured project"],
  ["investment_opportunity", "Investment opportunity"],
  ["new_inventory", "New inventory"],
  ["oman_update", "Oman development"],
  ["announcement", "Announcement"],
  ["collection_priority", "Collections priority"],
  ["campaign", "Campaign"],
] as const;

const EMPTY_SLIDE = {
  contentType: "announcement",
  eyebrow: "",
  title: "",
  description: "",
  fileId: null as string | null,
  primaryLabel: "",
  primaryHref: "",
  secondaryLabel: "",
  secondaryHref: "",
  startsAt: "",
  endsAt: "",
  priority: 100,
  pinned: false,
  audience: "all",
  status: "draft",
};

/** Client-side extraction: dimensions, blur placeholder, dominant color. */
async function extractImageMeta(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("unreadable image"));
      img.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = document.createElement("canvas");
    const scale = 20 / Math.max(width, height, 1);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return { width, height, blurDataUrl: undefined, dominantColor: undefined };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blurDataUrl = canvas.toDataURL("image/jpeg", 0.5);
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0, g = 0, b = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
    return { width, height, blurDataUrl, dominantColor: `#${hex(r)}${hex(g)}${hex(b)}` };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function HeroStudio() {
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [slides, setSlides] = useState<SlideRow[] | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [slideForm, setSlideForm] = useState<typeof EMPTY_SLIDE & { id?: string }>(EMPTY_SLIDE);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Upload metadata
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upAlt, setUpAlt] = useState("");
  const [upClassification, setUpClassification] = useState("photo");
  const [upLicense, setUpLicense] = useState("owned");
  const [upSource, setUpSource] = useState("alwalaa_owned");
  const [upOwner, setUpOwner] = useState("Alwalaa Real Estate");
  const [upAttribution, setUpAttribution] = useState("");
  const [upKind, setUpKind] = useState("hero_general");
  const [upLocation, setUpLocation] = useState("");
  const [upReports, setUpReports] = useState(true);
  const [upApprove, setUpApprove] = useState(true);

  const say = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const refresh = useCallback(async () => {
    const [a, s] = await Promise.all([
      fetch("/api/media/assets").then((r) => r.json()).catch(() => null),
      fetch("/api/hero/slides").then((r) => r.json()).catch(() => null),
    ]);
    setAssets(a?.assets ?? []);
    setSlides(s?.slides ?? []);
    if (a?.setup || s?.setup) say("err", "Storage is not configured (SUPABASE_SERVICE_ROLE_KEY) — the studio is read-only.");
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function patchAsset(id: string, body: Record<string, unknown>) {
    const r = await fetch("/api/media/assets", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const j = await r.json();
    if (j.updated) refresh();
    else say("err", j.detail ?? j.error ?? "Update failed");
  }

  async function upload() {
    if (!upFile) return;
    setUploading(true);
    try {
      const meta = await extractImageMeta(upFile);
      const form = new FormData();
      form.append("file", upFile);
      form.append(
        "meta",
        JSON.stringify({
          altText: upAlt,
          classification: upClassification,
          sourceType: upSource,
          licenseType: upLicense,
          licenseAllowsHero: true,
          licenseAllowsReports: upReports,
          ownerName: upOwner || undefined,
          attribution: upAttribution || undefined,
          kind: upKind,
          locationLabel: upLocation || undefined,
          widthPx: meta.width,
          heightPx: meta.height,
          blurDataUrl: meta.blurDataUrl,
          dominantColor: meta.dominantColor,
          approve: upApprove,
        }),
      );
      const r = await fetch("/api/media/upload", { method: "POST", body: form });
      const j = await r.json();
      if (j.uploaded) {
        say("ok", `Uploaded${upApprove ? " and approved" : " — pending approval"}.`);
        setUpFile(null);
        setUpAlt("");
        setUpAttribution("");
        refresh();
      } else {
        say("err", j.detail ?? j.error ?? "Upload failed");
      }
    } catch (e) {
      say("err", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveSlide(status?: string) {
    const f = slideForm;
    const body = {
      id: f.id,
      contentType: f.contentType,
      eyebrow: f.eyebrow || null,
      title: f.title,
      description: f.description || null,
      fileId: f.fileId,
      primaryLabel: f.primaryLabel || null,
      primaryHref: f.primaryHref || null,
      secondaryLabel: f.secondaryLabel || null,
      secondaryHref: f.secondaryHref || null,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
      endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
      priority: f.priority,
      pinned: f.pinned,
      audience: f.audience,
      status: status ?? f.status,
    };
    const r = await fetch("/api/hero/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.saved) {
      say("ok", j.saved.status === "published" ? "Slide published." : "Slide saved.");
      setSlideForm(EMPTY_SLIDE);
      refresh();
    } else {
      say("err", j.detail ?? j.error ?? "Save failed");
    }
  }

  function editSlide(s: SlideRow) {
    setSlideForm({
      id: s.id,
      contentType: s.content_type,
      eyebrow: s.eyebrow ?? "",
      title: s.title,
      description: s.description ?? "",
      fileId: s.file_id,
      primaryLabel: s.primary_label ?? "",
      primaryHref: s.primary_href ?? "",
      secondaryLabel: s.secondary_label ?? "",
      secondaryHref: s.secondary_href ?? "",
      startsAt: s.starts_at ? s.starts_at.slice(0, 16) : "",
      endsAt: s.ends_at ? s.ends_at.slice(0, 16) : "",
      priority: s.priority,
      pinned: s.pinned,
      audience: s.audience,
      status: s.status,
    });
  }

  const pickedAsset = assets?.find((a) => a.id === slideForm.fileId) ?? null;

  return (
    <div className="space-y-6">
      {notice && (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            notice.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : "border-risk/30 bg-risk/10 text-risk",
          )}
        >
          {notice.text}
        </p>
      )}

      {/* ---------------- Slide editor ---------------- */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg text-gold">{slideForm.id ? "Edit slide" : "New hero slide"}</h2>
          {slideForm.id && (
            <button type="button" onClick={() => setSlideForm(EMPTY_SLIDE)} className="text-xs text-white/50 hover:text-white">
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={LABEL}>Content type</span>
            <select className={FIELD} value={slideForm.contentType} onChange={(e) => setSlideForm({ ...slideForm, contentType: e.target.value })}>
              {CONTENT_TYPES.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Title</span>
            <input className={FIELD} value={slideForm.title} onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })} placeholder="Al Mouj attracts RO 880 million in FDI" />
          </label>
          <label className="block">
            <span className={LABEL}>Eyebrow label</span>
            <input className={FIELD} value={slideForm.eyebrow} onChange={(e) => setSlideForm({ ...slideForm, eyebrow: e.target.value })} placeholder="Oman Observer · Aug 2026" />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Description</span>
            <input className={FIELD} value={slideForm.description} onChange={(e) => setSlideForm({ ...slideForm, description: e.target.value })} />
          </label>
          <label className="block">
            <span className={LABEL}>Primary action label</span>
            <input className={FIELD} value={slideForm.primaryLabel} onChange={(e) => setSlideForm({ ...slideForm, primaryLabel: e.target.value })} placeholder="Read article" />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Primary action link</span>
            <input className={FIELD} value={slideForm.primaryHref} onChange={(e) => setSlideForm({ ...slideForm, primaryHref: e.target.value })} placeholder="/inventory or https://…" />
          </label>
          <label className="block">
            <span className={LABEL}>Secondary label</span>
            <input className={FIELD} value={slideForm.secondaryLabel} onChange={(e) => setSlideForm({ ...slideForm, secondaryLabel: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className={LABEL}>Secondary link</span>
            <input className={FIELD} value={slideForm.secondaryHref} onChange={(e) => setSlideForm({ ...slideForm, secondaryHref: e.target.value })} />
          </label>
          <label className="block">
            <span className={LABEL}>Publish from</span>
            <input type="datetime-local" className={FIELD} value={slideForm.startsAt} onChange={(e) => setSlideForm({ ...slideForm, startsAt: e.target.value })} />
          </label>
          <label className="block">
            <span className={LABEL}>Expires</span>
            <input type="datetime-local" className={FIELD} value={slideForm.endsAt} onChange={(e) => setSlideForm({ ...slideForm, endsAt: e.target.value })} />
          </label>
          <label className="block">
            <span className={LABEL}>Priority (lower first)</span>
            <input type="number" className={FIELD} value={slideForm.priority} onChange={(e) => setSlideForm({ ...slideForm, priority: Number(e.target.value) || 100 })} />
          </label>
          <label className="block">
            <span className={LABEL}>Audience</span>
            <select className={FIELD} value={slideForm.audience} onChange={(e) => setSlideForm({ ...slideForm, audience: e.target.value })}>
              <option value="all">Everyone</option>
              <option value="admin">Admin only</option>
              <option value="agents">Agents only</option>
            </select>
          </label>
          <div className="flex items-end gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={slideForm.pinned}
              onClick={() => setSlideForm({ ...slideForm, pinned: !slideForm.pinned })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition",
                slideForm.pinned ? "border-gold/50 bg-gold/15 text-gold" : "border-hairline text-white/55",
              )}
            >
              <Pin className="h-3 w-3" /> Pinned
            </button>
          </div>
        </div>

        {/* Image picker */}
        <div className="mt-4 rounded-xl border border-hairline p-3">
          <div className="flex items-center justify-between">
            <span className={LABEL}>Slide image (approved &amp; hero-licensed only)</span>
            <button type="button" onClick={() => setPicking((p) => !p)} className="text-xs text-gold hover:underline">
              {picking ? "Close picker" : slideForm.fileId ? "Change image" : "Pick image"}
            </button>
          </div>
          {pickedAsset ? (
            <div className="mt-2 flex items-center gap-3">
              {pickedAsset.preview_url && (
                <img src={pickedAsset.preview_url} alt={pickedAsset.alt_text ?? ""} className="h-14 w-24 rounded-lg object-cover" />
              )}
              <div className="text-xs text-white/60">
                {pickedAsset.filename} · {pickedAsset.classification ?? "unclassified"} ·{" "}
                {pickedAsset.approval_status}
              </div>
              <button type="button" aria-label="Remove image" onClick={() => setSlideForm({ ...slideForm, fileId: null })} className="text-white/40 hover:text-risk">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-white/40">No image — the slide renders branded Alwalaa artwork (always safe).</p>
          )}
          {picking && assets && (
            <div className="mt-3 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
              {assets
                .filter((a) => a.approval_status === "approved" && a.license_allows_hero)
                .map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setSlideForm({ ...slideForm, fileId: a.id }); setPicking(false); }}
                    className="group relative overflow-hidden rounded-lg border border-hairline focus-visible:ring-2 focus-visible:ring-gold/60"
                    title={a.alt_text ?? a.filename}
                  >
                    {a.preview_url ? (
                      <img src={a.preview_url} alt={a.alt_text ?? ""} className="h-16 w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <span className="grid h-16 place-items-center text-[10px] text-white/40">no preview</span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => saveSlide("draft")} disabled={!slideForm.title} className="rounded-md border border-hairline px-4 py-2 text-sm text-white/70 transition hover:border-gold/40 hover:text-white disabled:opacity-40">
            Save draft
          </button>
          <button type="button" onClick={() => saveSlide("published")} disabled={!slideForm.title} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-soft disabled:opacity-40">
            {slideForm.id ? "Save & publish" : "Publish"}
          </button>
        </div>
      </Card>

      {/* ---------------- Slides list ---------------- */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg text-gold">Slides</h2>
          <button type="button" onClick={refresh} aria-label="Refresh" className="text-white/40 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {!slides || slides.length === 0 ? (
          <p className="text-sm text-white/45">No slides yet — the portal shows live business + news slides automatically.</p>
        ) : (
          <ul className="space-y-2">
            {slides.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-ink-900/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {s.pinned && <Pin className="h-3 w-3 shrink-0 text-gold" />}
                    <span className="truncate text-sm font-medium text-white">{s.title}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {s.content_type.replace(/_/g, " ")} · {s.audience} · priority {s.priority}
                    {s.starts_at ? ` · from ${s.starts_at.slice(0, 10)}` : ""}
                    {s.ends_at ? ` · until ${s.ends_at.slice(0, 10)}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    s.status === "published" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/50",
                  )}
                >
                  {s.status}
                </span>
                <button type="button" onClick={() => editSlide(s)} className="shrink-0 text-xs text-gold hover:underline">
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Archive ${s.title}`}
                  onClick={async () => {
                    await fetch("/api/hero/slides", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: s.id }) });
                    refresh();
                  }}
                  className="shrink-0 text-white/35 hover:text-risk"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------- Media library ---------------- */}
      <Card>
        <h2 className="mb-3 text-lg text-gold">Media library</h2>

        {/* Upload */}
        <div className="rounded-xl border border-hairline p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-3">
              <span className={LABEL}>Image file (JPG · PNG · WEBP · AVIF, max 15 MB)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => setUpFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-white/60 file:me-3 file:rounded-md file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={LABEL}>Alt text (required)</span>
              <input className={FIELD} value={upAlt} onChange={(e) => setUpAlt(e.target.value)} placeholder="Marina apartments at Al Mouj at dusk" />
            </label>
            <label className="block">
              <span className={LABEL}>Classification</span>
              <select className={FIELD} value={upClassification} onChange={(e) => setUpClassification(e.target.value)}>
                <option value="photo">Photograph</option>
                <option value="developer_render">Developer rendering</option>
                <option value="arch_visualization">Architectural visualization</option>
                <option value="concept">Concept image</option>
                <option value="stock">Stock image</option>
                <option value="branded_graphic">Branded graphic</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>License</span>
              <select className={FIELD} value={upLicense} onChange={(e) => setUpLicense(e.target.value)}>
                <option value="owned">Alwalaa-owned</option>
                <option value="developer_approved">Developer-approved</option>
                <option value="editorial">Licensed editorial</option>
                <option value="royalty_free">Royalty-free</option>
                <option value="rights_managed">Rights-managed</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Source</span>
              <select className={FIELD} value={upSource} onChange={(e) => setUpSource(e.target.value)}>
                <option value="alwalaa_owned">Alwalaa media</option>
                <option value="inventory">Inventory shoot</option>
                <option value="developer">Developer media kit</option>
                <option value="licensed_stock">Licensed stock</option>
                <option value="upload">Other upload</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Usage kind</span>
              <select className={FIELD} value={upKind} onChange={(e) => setUpKind(e.target.value)}>
                <option value="hero_general">General hero</option>
                <option value="inventory">Inventory</option>
                <option value="render">Render</option>
                <option value="location">Location</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Owner / provider</span>
              <input className={FIELD} value={upOwner} onChange={(e) => setUpOwner(e.target.value)} />
            </label>
            <label className="block">
              <span className={LABEL}>Attribution (if required)</span>
              <input className={FIELD} value={upAttribution} onChange={(e) => setUpAttribution(e.target.value)} placeholder="© Al Mouj Muscat" />
            </label>
            <label className="block">
              <span className={LABEL}>Location label</span>
              <input className={FIELD} value={upLocation} onChange={(e) => setUpLocation(e.target.value)} placeholder="Al Mouj, Muscat" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" checked={upReports} onChange={(e) => setUpReports(e.target.checked)} /> License covers report distribution
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-white/60">
              <input type="checkbox" checked={upApprove} onChange={(e) => setUpApprove(e.target.checked)} /> Approve immediately (I attest the license)
            </label>
            <button
              type="button"
              onClick={upload}
              disabled={!upFile || !upAlt || uploading}
              className="ms-auto inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-soft disabled:opacity-40"
            >
              <ImagePlus className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>

        {/* Library grid */}
        {!assets ? (
          <p className="mt-4 text-sm text-white/45">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">
            No media yet. Upload licensed photography above — until then every surface uses branded artwork.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a) => (
              <li key={a.id} className="rounded-xl border border-hairline bg-ink-900/40 p-2.5">
                {a.preview_url ? (
                  <button
                    type="button"
                    className="relative block w-full cursor-crosshair overflow-hidden rounded-lg"
                    title="Click to set the focal point"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 1000;
                      const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 1000;
                      patchAsset(a.id, { focalX: x, focalY: y });
                    }}
                  >
                    <img src={a.preview_url} alt={a.alt_text ?? ""} className="h-28 w-full object-cover" />
                    {a.focal_x != null && a.focal_y != null && (
                      <span
                        aria-hidden
                        className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold bg-gold/30"
                        style={{ left: `${a.focal_x * 100}%`, top: `${a.focal_y * 100}%` }}
                      />
                    )}
                  </button>
                ) : (
                  <div className="grid h-28 place-items-center rounded-lg bg-ink-100 text-[10px] text-white/35">no preview</div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-white/70">{a.filename}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase",
                      a.approval_status === "approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : a.approval_status === "rejected"
                          ? "bg-risk/15 text-risk"
                          : "bg-amber-500/15 text-amber-300",
                    )}
                  >
                    {a.approval_status}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-white/40">
                  {a.classification ?? "unclassified"} · {a.license_type ?? "no license"} ·{" "}
                  {a.width_px && a.height_px ? `${a.width_px}×${a.height_px}` : "no dims"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {a.approval_status !== "approved" && (
                    <button type="button" onClick={() => patchAsset(a.id, { approvalStatus: "approved" })} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-500/10">
                      <Check className="h-3 w-3" /> Approve
                    </button>
                  )}
                  {a.approval_status !== "rejected" && (
                    <button type="button" onClick={() => patchAsset(a.id, { approvalStatus: "rejected" })} className="inline-flex items-center gap-1 rounded-full border border-risk/40 px-2 py-0.5 text-[10px] text-risk hover:bg-risk/10">
                      <X className="h-3 w-3" /> Reject
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const alt = window.prompt("Alt text", a.alt_text ?? "");
                      if (alt != null) patchAsset(a.id, { altText: alt });
                    }}
                    className="ms-auto text-[10px] text-white/45 hover:text-white"
                  >
                    Alt text
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-white/35">
          Click an image to set its hero focal point (the gold dot). Only APPROVED, hero-licensed images with
          alt text can be attached to a published slide or matched to news — everything else stays on branded
          artwork. Renderings and visualizations are always labeled on the banner.
        </p>
      </Card>
    </div>
  );
}
