# Alwalaa AI Listing Agent

Private, elite real-estate intelligence system for **Alwalaa Real Estate**
(Sultanate of Oman). Built for Humood Aladhari.

> Upload an Oman project pack — inventory, brochures, renders, payment plans
> — and get investor-grade listings, WhatsApp pitches, comparison reports,
> and branded PDFs in under five minutes. Oman-specific: ITC freehold,
> Sultan Haitham City, Muscat yield bands burned into every prompt.

## Stack

- **Next.js 16** App Router · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** with Alwalaa brand theme (black · gold · white)
- **Supabase** — Postgres, Storage, Auth
- **Anthropic Claude Opus 4.7** — vision, adaptive thinking, prompt caching
- **Vercel** — hosting + auto-deploy

## Quick start

```bash
npm install
cp .env.example .env.local      # add your API keys
npm run dev                      # http://localhost:3000
```

Tests: `npm test` · Build: `npm run build` · Typecheck: `npm run typecheck`

## Project layout

```
.
├── src/                       Next.js app + business logic
│   ├── app/                   Pages + API routes (App Router)
│   ├── components/
│   ├── domain/inventory/      Pure TS schema + analytics (zero IO, tested)
│   ├── ai/                    Anthropic calls (normalize + generate)
│   ├── storage/inventory/     Repository pattern (Supabase + in-memory)
│   ├── lib/                   Anthropic client, Supabase clients, prompts
│   └── types/
├── docs/
│   ├── PRD.md                 Product requirements
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.sql    Core schema for Supabase
│   ├── DEV_INVENTORY_SCHEMA.sql  Developer-inventory module schema
│   ├── PROMPT_TEMPLATES.md    Full AI prompt library reference
│   ├── WIREFRAMES.md
│   ├── OUTPUT_EXAMPLES.md     Real example listings + reports
│   ├── MVP_BUILD_PLAN.md      Milestones + effort estimates
│   └── DEPLOY.md              Vercel + Supabase walkthrough
└── archive/
    └── streamlit-uae/         v0 Python prototype (superseded)
```

## What's working

- ✅ Drag-drop project upload → AI extraction with source-tagged fields
- ✅ Multi-platform listing generation (Property Finder, OLX, IG, WhatsApp,
  LinkedIn, Website) in EN + AR
- ✅ ROI scorecard, ideal-buyer prediction, WhatsApp pitch
- ✅ Comparison reports + branded print-to-PDF view
- ✅ **Developer-inventory module** (`/dev-inventory`): paste messy
  WhatsApp/Excel/PDF inventory → normalize → analytics dashboard → generate
  listings. Also exposed as JSON APIs for N8N (`/api/inventory/*`,
  `/api/analytics`, `/api/listings/generate`)

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the step-by-step
Supabase + Vercel walkthrough.

**Important:** the app now lives at the repo root, so Vercel auto-detects
Next.js with **zero configuration**. No "Root Directory" setting required.
