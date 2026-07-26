# Secret rotation runbook (July 2026)

The repo is **public** and previously contained hardcoded secrets. The code now
reads every secret from the environment and **fails closed** when one is
missing. Because the old values live in git history forever, they must be
**rotated** — removing them from code is not enough.

## What leaked and where it was used

| Secret | Old location | Consumers |
| --- | --- | --- |
| `x-sync-token` (one shared value) | `src/lib/deptApi.ts`, `supabase/functions/dept-api`, `supabase/functions/zoho-ingest` | Next.js app → dept-api; n8n → zoho-ingest |
| Owner recovery password | `src/app/api/auth/login/route.ts` | Owner login hatch |
| Demo/preview password | same file | Preview login |

## Rotation steps (~10 minutes, in order)

1. **Generate three new tokens** (one per integration — no more shared value):
   ```bash
   openssl rand -hex 24   # DEPT_API_TOKEN
   openssl rand -hex 24   # ZOHO_SYNC_TOKEN
   openssl rand -hex 24   # SHEETS_INGEST_TOKEN
   ```
2. **Supabase** — set the edge-function secrets and redeploy:
   ```bash
   supabase secrets set DEPT_API_TOKEN=... ZOHO_SYNC_TOKEN=... SHEETS_INGEST_TOKEN=... \
     --project-ref hpxaaiaoasgoazpgilht
   supabase functions deploy dept-api zoho-ingest --project-ref hpxaaiaoasgoazpgilht
   # sheets-ingest is deployed later, when the Drive sync goes live
   ```
3. **Vercel** (Project → Settings → Environment Variables, all environments):
   - `DEPT_API_TOKEN` = the new dept-api value
   - `OWNER_RECOVERY_PASSWORD` = a new strong password (the login hatch is
     disabled until this is set)
   - optionally `DEMO_PASSWORD` (leave unset to keep preview login disabled)
   Redeploy the app afterwards.
4. **n8n** — update the `x-sync-token` header in the Zoho sync workflow to the
   new `ZOHO_SYNC_TOKEN` value.
5. **Verify:** dept pages + copilots respond; the Zoho sync run succeeds; a
   request with the *old* token gets `401`.

## Guard rails now in code

- Edge functions return `503 not_configured` when their token secret is unset
  and `401` on a wrong token — an unconfigured deploy can never be open.
- The app's `deptApi()` returns a structured `not_configured` error instead of
  calling with an empty token.
- Login hatches (`OWNER_RECOVERY_PASSWORD`, `DEMO_PASSWORD`) only exist when
  the env var is explicitly set.
- `src/lib/secretHygiene.test.ts` fails the vitest gate if a long hex literal
  or an env→literal secret fallback ever reappears in `src/` or
  `supabase/functions/`.

## Page access (middleware)

`middleware.ts` is intentionally pass-through: owner-only mode, no login, by
design. The page-level gate is **Vercel → Settings → Deployment Protection**
(Standard Protection + Vercel Authentication, or a shared password). Verify it
is ON — with it off, anyone with the URL can read live business data. Moving to
real in-app auth is a product decision tracked on the handoff worklist.
