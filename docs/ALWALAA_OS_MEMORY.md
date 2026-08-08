# ALWALAA OS — MEMORY

Living build memory: what actually exists, verified against the live systems.
Created 2026-08-09 from a full drift inspection (this file did not previously
exist in the repo — treat everything here as verified on that date, and
re-verify before trusting it later).

## System of record

- Supabase project `alwalaa-os` (`hpxaaiaoasgoazpgilht`, ap-northeast-1, PG 17).
- 39 tables in `public`: 34 repo-managed (migrations 0000–0011) + 5 from the
  separate public **listing app** (`users`, `agents`, `communities`,
  `properties`, `investment_metrics` — camelCase/Prisma).
- Live migration history is partial: 0000–0005 were pasted without history;
  tracked versions: 0006, 0008, 0009, 0012.
- **Applied to live:** 0000–0009 + `0012_listing_rls` (2026-08-09).
- **Written but NOT yet applied to live:** `0010_investment_analysis`,
  `0011_visual_media` (Invest save/report + hero studio run setup-degraded
  until applied).

## Security state (verified 2026-08-09)

- All 34 repo-managed tables: RLS enabled with org-scoped policies.
- Listing tables: RLS enabled by 0012. Public SELECT policies on
  `communities`/`agents`/`properties`/`investment_metrics`; `users`
  (contains `passwordHash`) has NO policies — service-role/direct only.
  Verified as anon: properties 61 rows readable, users 0 rows.
- Known remaining gaps:
  - `/api/sync` authorizes open-by-default when `INTERNAL_API_TOKEN` is
    unset or `change-me` (src/app/api/sync/route.ts:8-13).
  - The n8n "Zoho Books → Supabase" workflow embeds the `x-sync-token`
    value in plaintext in its JSON — rotate `ZOHO_SYNC_TOKEN` when that
    workflow is retired or rebuilt.
  - docs/SECURITY-ROTATION.md's token matrix still applies.

## Edge functions (live)

- `zoho-ingest` v4 — invoice/payment upserts, `x-sync-token` auth,
  onConflict `(organization_id, external_id)`.
- `dept-api` v4 — dept snapshot + Anthropic tool-loop + handoff inbox.
- `sheets-ingest` exists in the repo but is **NOT deployed**.

## n8n (live instance: 12 workflows)

Active: **Alwalaa Publisher** (FB/IG posting, Cowork-triggered), **Email
Collectors — Hostinger** (IMAP → email_staging; the only thing that actually
executes daily), **Email Assistant — Telegram**.

Inactive: WhatsApp Document Intake MVP (Respond.io → Claude classify →
Google Drive filing; whitelist still placeholder, never run), Zoho Books →
Supabase (ran ONCE manually 2026-07-23 — invoices stale since; fetches only
first 200, no pagination), Respond.IO Claude AI Agent (draft), Social
Posting Handoff (unwired), email digest/backfill helpers, 2 junk drafts.

Repo n8n JSONs (`n8n/`) are templates, never imported: sheets-sync skeleton
(placeholder tab GIDs + credential), copilot webhook (unused — app runs on
`ANTHROPIC_API_KEY` directly).

## Data flows (actual, not aspirational)

- **Zoho invoices → Supabase**: manual n8n run only; last 2026-07-23; 87
  invoice rows (81 with external_id).
- **Google Sheets → DB**: `/api/sync` (on-demand only, nothing schedules
  it) reads 5 per-agent sheets via `GoogleSheetsAdapter` → Prisma writer.
  There are **no live Google Drive reads anywhere** (Drive appears only as
  folder links; the inactive WhatsApp bot would WRITE files to Drive).
- **Leads/deals/units**: written by the app + seeds; truth rule = only rows
  with `external_id` are business data.
- **Listing app** writes `properties`/`agents`/`users` directly (last
  writes 2026-08-01) — independent of this repo.
- **Lead basket** (`/portal`) is in-memory only; `/api/portal/sweep` is a
  cron target that nothing calls; state dies on deploy.
- **No scheduler exists anywhere**: no vercel.json crons, no .github/, the
  only schedules live inside inactive n8n workflows.

## Automation target (owner-stated)

Full automation, no live Drive reads, no n8n dependency, all data in
Supabase. Listing intent: "drop all inventory → organized by developer /
project / community → easily listable on any platform" — i.e. `units` +
`projects` stay the system of record and the listing layer should be
GENERATED from them (publish step + per-platform export adapters), not a
second hand-maintained catalog.

## Social connections (Phase 1 of the automation plan — built 2026-08-09)

- Migration `0013_social_platform` (applied live + repo): `social_accounts`
  (org RLS), `social_account_secrets` (NO policies — service-role only,
  tokens never client-readable), `social_posts` (unique
  `(organization_id, idempotency_key)`, dry-run gate), `social_metrics_snapshots`.
- Domain `src/domain/social/`: 8-platform registry with honest capability
  flags + connect checklists, per-platform post validation, deterministic
  idempotency keys, state machine where live publishing is ONLY reachable
  via `dry_run_ok`. 10 tests.
- Adapters `src/infrastructure/social/publisher.ts`: one `SocialPublisher`
  interface; native **Meta Graph** adapter (FB Page photo/feed +
  multi-photo, IG container/carousel flow, read-only verify); pending
  platforms return honest "adapter not shipped" — never fake success.
- API: `/api/social/accounts` (connect/verify/disconnect, audited),
  `/api/social/posts` (drafts; edits reset to draft), `/api/social/posts/publish`
  (dry_run validates token+media+rules with zero external writes; live is
  compare-and-set guarded, idempotent, audited). Posts may only use
  APPROVED, publicly-licensed media from the 0011 library.
- UI: `/settings/social` — connection cards for all 8 platforms with per-
  platform credential checklists, composer, dry-run→publish flow, history.
- NOT yet done: scheduled posting (needs the cron backbone phase),
  metrics ingestion job, TikTok/YouTube/LinkedIn/X/Threads adapters
  (activate per-platform when owner supplies developer-app credentials),
  n8n Publisher decommission (stays until native Meta path is verified
  with real credentials).

## Build log

- 2026-06→07: CRM core, copilot tool-loop, migrations 0000–0009 (see git
  history and docs/GO-LIVE.md, docs/phase-0-data-audit.md).
- 2026-07-31: Follow-up nudges (PR #10).
- 2026-08-02: Investment Intelligence (engine v1.0.0, migration 0010) +
  Visual media system (migration 0011). Both on PR #10; migrations pending
  in live.
- 2026-08-09: Drift inspection (this file); RLS gate closed via 0012
  (applied live + mirrored in repo).
