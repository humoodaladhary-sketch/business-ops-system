# Alwalaa AI Listing Agent

Private, elite, one-click real-estate intelligence system for **Alwalaa Real Estate** (Sultanate of Oman).

> Upload an Oman project pack — inventory, brochures, renders, payment plans — and get investor-grade listings, WhatsApp pitches, comparison reports, and branded PDFs in under five minutes. Oman-specific: ITC freehold, Sultan Haitham City, Muscat yield bands built into every prompt.

**Prepared for:** Humood Aladhari, CEO, Alwalaa Real Estate.

---

## Repository map

```
├── docs/                            ← Product documentation
│   ├── PRD.md                        Product requirements
│   ├── ARCHITECTURE.md               System architecture
│   ├── DATABASE_SCHEMA.sql           Supabase schema (paste-ready)
│   ├── PROMPT_TEMPLATES.md           AI prompt library (the IP)
│   ├── WIREFRAMES.md                 UI/UX wireframes
│   ├── OUTPUT_EXAMPLES.md            Real example listings + reports
│   ├── MVP_BUILD_PLAN.md             Milestones + effort estimates
│   └── DEPLOY.md                     Vercel + Supabase deploy walkthrough
├── web/                             ← Next.js 15 + TypeScript + Tailwind v4 + Supabase
│   ├── src/app/                      Pages + API routes
│   ├── src/lib/prompts/              Oman-specific prompt library
│   ├── src/lib/parsers/              Excel + PDF parsing
│   └── ...
└── archive/
    └── streamlit-uae/               ← v0 prototype (UAE-focused), superseded
```

---

## Stack

- **Next.js 15** App Router · **React 19** · **TypeScript**
- **Tailwind CSS v4** with Alwalaa brand theme (black · gold · white)
- **Supabase** — Postgres, Storage, Auth (magic link)
- **Anthropic Claude Opus 4.7** — vision, adaptive thinking, prompt caching
- **Vercel** — hosting + auto-deploy from GitHub

---

## What this MVP does

| Feature | Status |
|---|---|
| Drag-drop upload: Excel + PDF + renders | ✅ |
| AI extraction of units with source-tagged fields | ✅ (stateless) |
| Multi-platform listing generation (PF, OLX, IG, WhatsApp, LinkedIn, Website) | ✅ (stateless) |
| Bilingual output (English + Arabic) | ✅ |
| ROI + liquidity + appreciation scoring | ✅ API route |
| Buyer profile prediction (nationality, motivation, objections) | ✅ API route |
| Comparison reports (3 units + recommendation + WhatsApp pitch) | ✅ API route |
| Dashboard + upload UI | ✅ |
| Persistence (Supabase) | ⏳ Milestone M1 |
| Inventory UI with filters | ⏳ Milestone M1 |
| Listing tabs UI + copy/edit | ⏳ Milestone M2 |
| Audit (source badges) UI | ⏳ Milestone M3 |
| Comparison UI + PDF export | ⏳ Milestone M4 |
| Auth + production hardening | ⏳ Milestone M5 |

Full milestone breakdown and effort estimates: [`docs/MVP_BUILD_PLAN.md`](docs/MVP_BUILD_PLAN.md).

---

## Deploy now

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the step-by-step Supabase + Vercel walkthrough (beginner-friendly, ~25 min first time).

---

## Oman-specific intelligence

The real IP of the system is the prompt library in `web/src/lib/prompts/`. Every call uses a shared system prompt that encodes:

- **ITC mechanics** — which zones are freehold, which aren't, what residency benefits come with ownership.
- **Sultan Haitham City thesis** — government-backed smart-city positioning with infrastructure pipeline notes.
- **Muscat yield bands** — 2025 working assumptions by unit type, with +50bps adjustments for ITC/SHC/sea view.
- **Alwalaa brand voice** — elegant, direct, investor-first. Forbidden-word list enforced.
- **Approved CTAs** (EN + AR) — the AI can only pick from this list.
- **Separation of extracted / inferred / assumed / missing** — every field traceable to a source file.

See [`docs/PROMPT_TEMPLATES.md`](docs/PROMPT_TEMPLATES.md) for the full human-reviewable library.

---

## The old Streamlit prototype

The previous (UAE-focused) version is preserved in `archive/streamlit-uae/` for
reference. The new Oman-specific Next.js version supersedes it completely.
