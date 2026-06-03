# MVP Build Plan

Delivering the Alwalaa AI Listing Agent from skeleton to private beta.
Milestones are sequenced so every one ends with something Humood can click.

Estimates are in **developer-days** of focused work.

---

## M0 — Foundation (this turn)

| Item | Status |
|---|---|
| Monorepo split: `web/`, `docs/`, `archive/` | ✅ |
| All 8 documentation deliverables drafted | ✅ |
| Oman-specific prompt library | ✅ |
| Supabase SQL schema | ✅ |
| Next.js 15 scaffold with TypeScript + Tailwind | ✅ |
| Brand theme (black / gold / white) wired into Tailwind | ✅ |
| Landing + Dashboard pages | ✅ |
| Upload page with drag-drop | ✅ |
| `/api/extract` route (stub calling Claude) | ✅ |
| `/api/units/[id]/generate` route | ✅ |
| `/api/units/[id]/pitch` route | ✅ |
| Supabase client helpers (server + browser) | ✅ |

Output: a runnable Next.js app with the core plumbing wired and the prompt
library in place. Ready for deployment to Vercel.

---

## M1 — Upload + extraction end-to-end (2–3 days)

Goal: user can upload a real project pack and see unit rows appear.

- [ ] Supabase Storage bucket + RLS policies created
- [ ] File upload via `<input type=file>` streaming to Storage
- [ ] Project form (name, developer, zone) with autosave
- [ ] `/api/extract` fully functional:
  - [ ] Parse Excel with `xlsx`
  - [ ] Parse PDF text with `pdf-parse`
  - [ ] Build multi-image vision message for renders
  - [ ] Call Claude Opus 4.7 with the extraction prompt
  - [ ] Validate output with Zod against TypeScript types
  - [ ] Insert `projects`, `files`, `units`, `unit_fields` rows
- [ ] Inventory list page shows extracted units with source badges

Deliverable: drop in an Excel + brochure, click Extract, see 20+ units
populated in the DB with source-tagged fields.

---

## M2 — Listing + pitch generation (2 days)

Goal: click "Generate all listings" and get 12 listings (6 platforms × 2
languages) per unit.

- [ ] Per-platform listing JSON output
- [ ] Parallelized platform × language generation (one call per)
- [ ] Listings persisted in `listings` table
- [ ] Unit detail page tabbed view: listings per platform/language
- [ ] Inline editing of title/body with autosave
- [ ] Character counters enforcing `platforms.yaml` limits
- [ ] Copy-to-clipboard button per block
- [ ] Download all platforms as ZIP
- [ ] `/api/units/[id]/pitch` returning the bilingual WhatsApp pitch
- [ ] Instagram caption uses render captions from extraction step

Deliverable: click a unit → click "Generate all listings" → 12 tabs of
publication-ready content.

---

## M3 — ROI, buyer, audit surfaces (1.5 days)

- [ ] `/api/units/[id]/roi` — runs ROI prompt, persists `roi_scores`
- [ ] `/api/units/[id]/buyer` — runs buyer prompt, persists `buyer_profiles`
- [ ] Unit detail AUDIT tab showing source badges per field
- [ ] Unit detail BUYER tab with pitch + objections
- [ ] Inventory filters: min yield, ITC-only, price range
- [ ] Bulk-generate across filtered selection

---

## M4 — Reports (2 days)

- [ ] Comparison report creator — brief input OR filter
- [ ] Top-N ranking logic using composite ROI score
- [ ] `/api/reports/comparison` running comparison prompt
- [ ] Comparison table UI
- [ ] WhatsApp pitch output for comparison
- [ ] PDF export via `@react-pdf/renderer` with Alwalaa brand template
- [ ] Investor report (single unit, full page)

---

## M5 — Auth, access, production hardening (1 day)

- [ ] Supabase Auth (magic link) + signup disabled by default
- [ ] Admin page to invite team members
- [ ] Route guards (only authenticated org members)
- [ ] RLS policies tested with `pgTAP` or manual script
- [ ] Cost-cap env var enforced per-project
- [ ] Vercel deploy + custom domain
- [ ] Supabase backup schedule + env vars documented

---

## M6 — Polish (ongoing)

- [ ] PDF template refinement (review with Humood)
- [ ] Arabic typography polish (IBM Plex Sans Arabic)
- [ ] Dark-mode toggle (optional)
- [ ] Image gallery with render-captioned lightbox
- [ ] Search over units (pg `tsvector`)
- [ ] Audit log viewer (regeneration history)

---

## Effort totals

| Phase | Days |
|---|---|
| M0 foundation | done |
| M1 upload + extract | 2–3 |
| M2 listings + pitch | 2 |
| M3 ROI + buyer + audit | 1.5 |
| M4 reports | 2 |
| M5 auth + prod | 1 |
| **MVP total** | **~8.5 days** |

---

## Risks to the plan

| Risk | Mitigation |
|---|---|
| Oman zone lookup table is thin at start | Curate Sultan Haitham + AIDA + Muscat Hills + Al Mouj at launch; expand as projects are onboarded. |
| Image-scanned brochures kill text extraction | Fall back to vision-based page-by-page read. Track failure rate; if >20%, add Tesseract OCR pre-step. |
| Arabic prompt quality regression | Have a native-speaker reviewer sanity-check first 50 listings; iterate on the Arabic voice prompts. |
| Vercel serverless function timeout (60s) | Extraction and comparison are the only calls that risk this — we stream + chunk per unit, not per project. |
| Supabase free tier DB size | Free 500MB is plenty for MVP (text-heavy, file bytes are in Storage, not DB). |

---

## Post-MVP roadmap (out of scope for MVP but designed for)

1. **CRM pipeline** — tie each listing to leads, track conversion.
2. **Auto-publish** — Property Finder and OLX Oman API integrations.
3. **Analytics** — yield tracking vs. realized rent, listing-to-lead
   conversion per platform.
4. **Multi-tenant** — open the platform to other Oman brokerages under
   Alwalaa white-label.
5. **WhatsApp Business API** — send pitches directly from the system.
6. **Video listings** — Runway or Sora-based render-to-reel.
