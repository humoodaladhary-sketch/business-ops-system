# Alwalaa AI Listing Agent — Web

Next.js 15 + TypeScript + Tailwind v4 + Supabase + Anthropic Claude Opus 4.7.

## Quick start (local)

```bash
cd web
npm install
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY and Supabase keys
npm run dev
```

Open http://localhost:3000.

## Environment

See `.env.example`. Required:

- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Optional:

- `MAX_OMR_SPEND_PER_PROJECT` (cost cap)
- `NEXT_PUBLIC_ALWALAA_WHATSAPP` / `_EMAIL` (appear in generated pitches)

## Structure

```
src/
├── app/
│   ├── api/              # Server routes for AI calls
│   │   ├── extract/               POST — files → units
│   │   ├── generate-listing/      POST — unit + platform → listing
│   │   ├── generate-pitch/        POST — unit → bilingual WhatsApp pitch
│   │   ├── generate-roi/          POST — unit → ROI scorecard
│   │   ├── generate-buyer/        POST — unit → buyer profile
│   │   └── generate-comparison/   POST — units + brief → comparison report
│   ├── upload/           # Upload page with drag-drop
│   ├── inventory/        # (M1) unit list + filters
│   ├── reports/          # (M4) comparison builder
│   └── page.tsx          # Dashboard
├── components/brand/     # Header + footer + logo placeholder
├── lib/
│   ├── anthropic.ts              # Claude client + JSON helpers
│   ├── oman-context.ts           # ITC zones, yield bands, CTAs
│   ├── pricing.ts                # OMR → USD/EUR/INR conversions
│   ├── parsers/{excel,pdf}.ts
│   ├── prompts/                  # Prompt templates (THE IP)
│   │   ├── _system.ts            # System prompt (cached)
│   │   ├── extraction.ts
│   │   ├── listing.ts
│   │   ├── roi.ts
│   │   ├── buyer.ts
│   │   ├── pitch.ts
│   │   └── comparison.ts
│   └── supabase/{server,browser}.ts
└── types/index.ts        # TypeScript types matching the DB schema
```

## Brand

Logo file goes in `public/brand/alwalaa-logo.png` (preserving aspect ratio).
Colors are defined as CSS custom properties in `src/app/globals.css`:

- `--color-brand-black: #0A0A0A`
- `--color-brand-gold: #D4A017`
- `--color-brand-white: #FFFFFF`
- `--color-brand-ivory: #FAF8F3`

## Deploy

See `../docs/DEPLOY.md` — step-by-step Vercel + Supabase walkthrough.

## What's working now vs planned

See `../docs/MVP_BUILD_PLAN.md`. Short version:

- ✅ M0 — Scaffolding, prompt library, all API routes, dashboard/upload pages
- ⏳ M1 — Persistence in Supabase, inventory UI
- ⏳ M2 — Listing tabs UI, copy/edit, ZIP export
- ⏳ M3 — ROI + buyer + audit UI
- ⏳ M4 — Comparison report builder + PDF export
- ⏳ M5 — Auth + deploy hardening
