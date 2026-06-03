# System Architecture

## 1. High-level diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Alwalaa AI Listing Agent                 │
└─────────────────────────────────────────────────────────────┘

 Browser (Humood / team)
   │
   │  HTTPS
   ▼
┌─────────────────────────────────┐        ┌───────────────────┐
│      Next.js 15 (Vercel)        │◀──────▶│    Supabase       │
│  ── App Router                  │  SQL   │  · Postgres DB    │
│  ── React Server Components     │        │  · Auth (magic    │
│  ── Tailwind + shadcn/ui        │        │    link)          │
│  ── API Routes (edge + node)    │        │  · Storage        │
└──────────────┬──────────────────┘        │    (brochures,    │
               │                            │    renders, PDFs) │
               │ HTTPS                      └───────────────────┘
               ▼
     ┌─────────────────────┐
     │  Anthropic API      │
     │  claude-opus-4-7    │
     │  · vision           │
     │  · web_search       │
     │  · adaptive thinking│
     │  · prompt caching   │
     └─────────────────────┘

     ┌─────────────────────┐
     │  pdf-parse, xlsx    │
     │  (inside Next API)  │
     └─────────────────────┘
```

## 2. Request flows

### 2.1 Project upload + extraction

```
User drops Excel + PDFs + images
    │
    ▼
POST /api/projects (multipart)
    │
    ├── stream files → Supabase Storage
    ├── insert rows: projects, files
    └── enqueue extraction
        │
        ▼
POST /api/extract (server action)
    │
    ├── parse Excel → draft unit rows
    ├── extract PDF text (pdf-parse)
    ├── Claude Opus 4.7 with adaptive thinking:
    │     "Given these files + Excel rows, produce normalized Unit objects
    │      with every field tagged {extracted|inferred|assumed|missing}"
    ├── validate against TypeScript schema
    └── insert rows: units, unit_fields (one per field with source tag)
```

### 2.2 Per-unit listing generation

```
User clicks "Generate all listings" on a unit
    │
    ▼
POST /api/units/:id/generate
    │
    ├── load unit + project context + linked files
    ├── for each platform × language:
    │     Claude Opus 4.7
    │       system: cached Alwalaa brand + platform rules
    │       user:   unit JSON + render vision summaries + market context
    │       → JSON { title, body, cta, hashtags }
    ├── insert rows: listings (one per platform/language)
    └── return listing set
```

### 2.3 Comparison report

```
User submits filter / brief
    │
    ▼
POST /api/reports/comparison
    │
    ├── SQL filter against units
    ├── top N candidates ranked by composite ROI score
    ├── Claude Opus 4.7:
    │     "Given these 3 units, produce pros/cons + recommendation + pitch"
    ├── render PDF via @react-pdf/renderer with Alwalaa brand template
    └── return { pdf_url, whatsapp_pitch, comparison_json }
```

## 3. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15** (App Router) | SSR, server actions, API routes, Vercel-native |
| Language | **TypeScript** | Shared types across client/server, catches AI-output mismatches early |
| Styling | **Tailwind CSS** + shadcn/ui | Brand-consistent, fast to build |
| DB | **Supabase Postgres** | Row-level security, magic-link auth bundled |
| Auth | **Supabase Auth** (magic link + Google OAuth) | Zero backend code |
| Storage | **Supabase Storage** | Signed URLs, integrates with auth policies |
| AI | **Anthropic Claude Opus 4.7** | Best vision, best on-brand copy, adaptive thinking |
| PDF parsing | **pdf-parse** (Node) | Lightweight, pure JS |
| Excel parsing | **xlsx** (SheetJS) | Proven, browser+node |
| PDF generation | **@react-pdf/renderer** | React components → branded PDF |
| Deployment | **Vercel** (app) + **Supabase Cloud** | Both free-tier generous |

## 4. Folder layout

```
business-ops-system/
├── docs/                     # PRD, architecture, prompts, wireframes, build plan
├── archive/
│   └── streamlit-uae/        # v0 prototype (superseded)
└── web/                      # Next.js app
    ├── public/
    │   └── brand/            # logo.png, wordmark.svg
    ├── src/
    │   ├── app/              # App Router
    │   │   ├── layout.tsx
    │   │   ├── page.tsx          # Dashboard
    │   │   ├── upload/
    │   │   ├── inventory/
    │   │   ├── units/[id]/
    │   │   ├── reports/
    │   │   └── api/
    │   │       ├── projects/         POST (create + upload)
    │   │       ├── extract/          POST (run extraction on a project)
    │   │       ├── units/[id]/
    │   │       │   ├── generate/     POST (all platforms)
    │   │       │   ├── pitch/        POST (WhatsApp pitch)
    │   │       │   └── roi/          POST (recompute ROI)
    │   │       └── reports/
    │   │           └── comparison/   POST (3-unit comparison)
    │   ├── components/
    │   │   ├── brand/            # logo, header, footer
    │   │   ├── upload/
    │   │   ├── unit/
    │   │   ├── listing/
    │   │   └── ui/               # shadcn primitives
    │   ├── lib/
    │   │   ├── anthropic.ts          # client wrapper
    │   │   ├── supabase/             # server + browser clients
    │   │   ├── parsers/
    │   │   │   ├── excel.ts
    │   │   │   └── pdf.ts
    │   │   ├── prompts/
    │   │   │   ├── _system.ts        # brand + rules header
    │   │   │   ├── extraction.ts
    │   │   │   ├── listing.ts
    │   │   │   ├── buyer.ts
    │   │   │   ├── roi.ts
    │   │   │   ├── comparison.ts
    │   │   │   └── pitch.ts
    │   │   ├── oman-context.ts       # ITC zones, Muscat yield bands
    │   │   └── pricing.ts
    │   └── types/
    │       └── index.ts              # Unit, Listing, Project, etc.
    └── supabase/
        └── schema.sql
```

## 5. Database (Supabase Postgres)

Full SQL in [`DATABASE_SCHEMA.sql`](./DATABASE_SCHEMA.sql). Overview:

```
organizations ──┬─< users
                └─< projects ──┬─< files
                               ├─< units ──┬─< listings
                               │            ├─< roi_scores
                               │            ├─< buyer_profiles
                               │            └─< unit_fields     -- source-tagged facts
                               └─< reports
```

Every AI-generated row has `model_version`, `prompt_hash`, `created_at`,
`created_by`. Unit fields carry `source ENUM('extracted','inferred','assumed','missing')`
and a `source_file_id` where applicable — that's the audit trail.

## 6. Security

- **Supabase RLS enabled on every table.** Default deny. Access grants are
  scoped to `organizations.id = auth.jwt().organization_id`.
- **No ANON role writes.** All mutations go through service-role Next.js API
  routes, which check the authenticated user's org before proceeding.
- **API keys never leave the server.** Client calls Next.js API; Next.js
  calls Anthropic with the server-only `ANTHROPIC_API_KEY` env var.
- **Uploaded files are private.** Storage bucket is non-public; the app
  generates signed URLs on demand.

## 7. AI efficiency

- **Prompt caching** on the system prompt (brand book + Oman context + platform
  rules) — about 8–12K tokens, cached with `cache_control: ephemeral`.
  Saves ~90% on that prefix after the first call.
- **Adaptive thinking** on all listing and report calls.
- **Batching** — per project, extraction runs in one call; listing generation
  runs N platform calls in parallel per unit.
- **Cost caps** — env var `MAX_OMR_SPEND_PER_PROJECT` aborts if the running
  tally exceeds the threshold.

## 8. Environments

| Env | URL pattern | Branch | Notes |
|---|---|---|---|
| Dev | localhost:3000 | any | `.env.local` |
| Preview | `<pr>-<project>.vercel.app` | any PR | Vercel auto-preview per PR |
| Production | `app.alwalaa.om` (or similar) | `main` | Custom domain via Vercel |
