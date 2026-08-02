# Visual media & hero banner — architecture, rights, and admin guide

The Command Portal's visual-media system: licensed photography on the hero
banner and dashboard, governed by explicit rights metadata, with branded
Alwalaa artwork as the honest fallback. Dated 2026-08-02.

## 1. Architecture

| Layer | What |
| --- | --- |
| Data | Migration `0011_visual_media`: governance columns on the existing `files` table (license, attribution, classification, approval, focal points, dimensions, blur placeholder) + `hero_slides` (scheduled editorial banner queue, RLS-protected) |
| Domain (`src/domain/media/`) | Pure + fully tested: `rights.ts` (the publication gate), `selection.ts` (deterministic source-priority image matching + focal→CSS), `heroSchedule.ts` (windows, pinning, priority, audience, 6-slide cap), `curator.ts` (deterministic ranking, quality warnings, duplicate detection), `upload.ts` (MIME/size/dimension/name/alt validation) |
| Adapters (`src/app/_data/`) | `heroMedia.ts` (approved pool, editorial slides, batch signed URLs, featured projects), `portalVisuals.ts` (assembly: choose assets → sign once → render props) |
| API | `/api/media/upload` (ADMIN, validated, private-bucket store + metadata row, audited), `/api/media/assets` (library list + governance PATCH incl. approve/reject/focal/alt), `/api/hero/slides` (CRUD + publish gate, audited) |
| UI | `PortalHero` v2 (photography + cinematic gradients, keyboard/swipe/pause/progress, reduced-motion, preload-first/lazy-rest), `BrandedArt` fallbacks, news cards, market-pulse sparklines, featured projects, funnel strip, opportunity card, aging bar, Oman mini-map |
| Admin | `/settings/hero` — slide editor (schedule, pin, priority, audience, actions, image picker) + media library (upload with client-side dimension/blur/dominant-color extraction, approve/reject, click-to-set focal point, alt text) |

## 2. Media rights model (the rules that cannot be bypassed)

Every image row carries: source type, owner, license type, hero/report
license flags, attribution, classification, approval status, alt text, focal
points, dimensions, verification date. `verifyUsage(asset, surface)` in
`src/domain/media/rights.ts` is the single gate:

- **Not approved → blocked.** Upload alone publishes nothing.
- **License unknown or missing → blocked.** "When in doubt, keep it out."
- **Surface-specific:** report distribution requires `license_allows_reports`
  — a hero-only license never reaches a client report.
- **Classification is mandatory** and honest: `photo`, `developer_render`,
  `arch_visualization`, `concept`, `stock`, `branded_graphic`. Renders and
  visualizations are LABELED on the banner (`requiresRenderingLabel`) —
  never presented as completed property.
- **Attribution** stored per asset is rendered wherever the image appears.
- **No association is invented.** News imagery is selected only via explicit
  matches (unit id → project id → project named in the headline → location
  label → media explicitly marked `hero_general`). An unrelated photo is
  never attached to a story — branded artwork is used instead.
- **No public buckets, no hotlinking.** Media lives in the private `alwalaa`
  bucket; the portal serves short-lived signed URLs created server-side; the
  Next image optimizer only accepts `*.supabase.co/storage/v1/object/sign/**`.

Audit events: `media.uploaded`, `media.approved`, `media.rejected`,
`media.updated`, `hero.slide.created/updated/published/archived`.

## 3. Admin instructions (`/settings/hero`)

1. **Upload** licensed imagery in the Media library: pick the file, write real
   alt text, state classification + license + source (and attribution when the
   license demands it). "Approve immediately" is your attestation that the
   license is genuine. The browser extracts dimensions, a blur placeholder and
   the dominant color automatically.
2. **Set the focal point** by clicking the subject on the thumbnail (gold
   dot). The hero and cards crop around it on every screen size.
3. **Create a slide**: content type, title, eyebrow, description, actions,
   optional schedule window, priority (lower = earlier), pin, audience.
   Attach an image from the picker (it lists only approved, hero-licensed
   media) or leave imageless for branded artwork.
4. **Publish.** A slide with an unapproved/unlicensed/alt-less image is
   rejected at publish time. Archive removes a slide from rotation.
5. The portal automatically fills remaining carousel slots (max 6) with live
   business slides — collections priority (pinned first when overdue), market
   news, latest closing, pipeline, inventory.

## 4. Performance & accessibility

- Only the first hero image is preloaded (`priority`); only active + adjacent
  slides mount images; carousel capped at 6; blur/dominant-color placeholders;
  explicit `sizes`; no layout shift (absolutely-positioned fills).
- Keyboard arrows, dot tablist, prev/next/pause buttons with focus rings,
  swipe on touch, hover pause, `prefers-reduced-motion` disables auto-advance,
  zoom and the progress bar; sr-only slide announcements; decorative art is
  `aria-hidden`; the aging bar and mini-map carry text alternatives.

## 5. Environment & storage

No new environment variables. Reuses `SUPABASE_SERVICE_ROLE_KEY` +
`NEXT_PUBLIC_SUPABASE_URL`. Storage: the existing private `alwalaa` bucket,
uploads under `media/`. Without a database key every surface renders branded
artwork and the studio is read-only — nothing breaks.

Migration to apply once in the Supabase SQL editor:
`supabase/migrations/0011_visual_media.up.sql`
(reverse: `0011_visual_media.down.sql`).

## 6. Changelog

- **2026-08-02** — Visual media system shipped: hero banner v2 with licensed
  photography + branded fallbacks, media governance (rights, classification,
  approval, focal points), admin Hero & Media studio, visual news cards,
  market-pulse sparklines, featured-project cards, sales-funnel strip,
  collections aging bar, investment-opportunity card, Oman mini-map,
  migration 0011. 46 new unit tests (media domain + funnel).
