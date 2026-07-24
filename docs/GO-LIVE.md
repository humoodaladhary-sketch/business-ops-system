# Going live — database, auth, and Google Sheets sync

## ⚡ Fast path (15 minutes)

1. Create a free **Supabase** project (supabase.com). From **Project Settings →
   Database** copy the **pooled** and **direct** connection strings; from
   **Project Settings → API** copy the **Project URL**, **anon** key and
   **service_role** key.
2. In **Vercel → Settings → Environment Variables**, set (then **Redeploy**):
   - `DATABASE_URL`, `DIRECT_URL` (from step 1)
   - `AUTH_PROVIDER` = `supabase`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `INTERNAL_API_TOKEN` = any long random string
   - ⚠️ **Delete** the old invalid `NEXT_PUBLIC_SUPABASE_URL` value first if present.
3. In the **Supabase SQL editor**, paste & run
   `supabase/migrations/00000000000000_init_schema.sql` (the full schema), then
   `supabase/migrations/20260603000000_auth_rls.sql` (row-level security).
4. Open **`https://YOUR-APP/setup`** — fill in your name, email, password and the
   `INTERNAL_API_TOKEN` value, click once: it creates your **Super Admin** account
   and seeds the ladder/floors/developers/projects/agents/targets. *(Advanced
   alternative: `GET /api/admin/bootstrap?token=…` with `SUPER_ADMIN_EMAIL`/
   `SUPER_ADMIN_PASSWORD` env vars.)*
5. Sign in at `/login` with that email + password. Then (optional) open
   `/api/sync?token=YOUR_INTERNAL_API_TOKEN` to pull the Google Sheets, and add
   team logins under **Settings → User Access**.
6. **Verify anytime:** open `https://YOUR-APP/api/health` — it reports, with no
   secrets, whether the database is connected, seeded, and real auth is on, plus
   a checklist of anything still pending.

> **Using the Vercel ↔ Supabase integration?** It injects `POSTGRES_PRISMA_URL`
> automatically and the app now reads that as the connection string, so you can
> **skip** setting `DATABASE_URL`/`DIRECT_URL` by hand. You still set
> `AUTH_PROVIDER=supabase` and `INTERNAL_API_TOKEN`.

That's it — the app is now on live data with real per-person logins. The detailed
version of every step is below.

Everything is built. To switch from the demo snapshot to **live data + real
per-person login**, do the steps below. You only create two accounts (Supabase +
a Google service account) and paste keys into Vercel. ~30 minutes.

The app degrades safely: until these are set it keeps using the demo login and
the baked snapshot, so nothing breaks while you set up.

---

## A. Supabase database + auth

1. Create a project at supabase.com → **Project Settings → Database** → copy the
   connection strings:
   - **Connection pooling** string → `DATABASE_URL`
   - **Direct connection** string → `DIRECT_URL`
2. **Project Settings → API** → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Create the schema + seed (run locally with the env set, or from the Supabase SQL editor):
   ```bash
   # locally, with DATABASE_URL/DIRECT_URL exported:
   pnpm db:migrate      # or: pnpm db:push
   pnpm db:seed         # ladder, floors, developers, agents, targets, stage maps
   ```
4. Apply row-level security: paste `supabase/migrations/*_auth_rls.sql` into the
   Supabase **SQL editor** and run it.

## B. Turn auth on

In **Vercel → Project → Settings → Environment Variables**, set:

| Variable | Value |
| :-- | :-- |
| `AUTH_PROVIDER` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | (from A2) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from A2) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from A2) |
| `DATABASE_URL`, `DIRECT_URL` | (from A1) |
| `INTERNAL_API_TOKEN` | any long random string |

> ⚠️ First, delete the current invalid `NEXT_PUBLIC_SUPABASE_URL` value that's
> already in Vercel (it caused the earlier 500s) and replace it with the real one.

Create each user under **Supabase → Authentication → Users**, then tag them with a
role + agent id (SQL editor):

```sql
-- CEO / admin (sees everything)
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"ADMIN"}'
where email = 'you@alwalaaoman.com';

-- An advisor (sees only their own data) — agent_id must match the seeded id
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"AGENT","agent_id":"alex"}'
where email = 'alex@alwalaaoman.com';
```
Agent ids: `shatha, alex, pasha, wesam, khalid, tariq`.

## C. Google Sheets sync

1. In **Google Cloud Console**: create a project → enable the **Google Sheets API**
   → create a **Service Account** → create a **JSON key** and download it.
2. Base64-encode the JSON and set it as `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`:
   ```bash
   base64 -w0 service-account.json   # macOS: base64 -i service-account.json
   ```
3. **Share each agent's Google Sheet** with the service account's email
   (`...@...iam.gserviceaccount.com`) as **Viewer**. (Sheets are listed in
   `src/infrastructure/ingestion/sheetRegistry.ts`.)
4. Run the sync (pulls every sheet → database):
   ```
   https://YOUR-APP/api/sync?token=YOUR_INTERNAL_API_TOKEN
   ```
   Returns a per-agent summary of deals/leads ingested and rejected rows.
5. **Schedule it** (the app doesn't depend on Vercel cron, which Hobby limits):
   point cron-job.org or an n8n schedule at that URL every 15–30 min.

Once the database has synced rows, every dashboard automatically switches from
the snapshot to **live data** (the data layer prefers the DB, falls back to the
snapshot if empty).

## D. Alerts (optional, later)

Set `ALERT_WEBHOOK_URL` to an n8n webhook to fan at-risk/milestone events out to
WhatsApp (Respond.io). The at-risk endpoint is `/api/webhooks/at-risk`.

---

### What runs where
- **Sheets → Database:** `GET/POST /api/sync` (token-protected) using the
  service account; idempotent upserts (safe to re-run).
- **Database → Dashboards:** `src/app/_data/source.ts` (`loadData()`), used by
  every page; falls back to the snapshot when the DB is empty/unreachable.
- **Auth:** `src/infrastructure/auth` — Supabase when `AUTH_PROVIDER=supabase`,
  else the demo login. RLS in `supabase/migrations`.
