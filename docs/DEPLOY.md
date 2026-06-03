# Deploy the Alwalaa AI Listing Agent

Three services. All free tier. ~20 minutes the first time.

## What you'll do

1. Create a Supabase project (5 min)
2. Run two SQL files in Supabase (3 min)
3. Push the code (already done if you're reading this)
4. Connect the GitHub repo to Vercel + paste 5 env vars (10 min)
5. Smoke-test the live URL (2 min)

---

## Step 1 — Supabase project

1. Open **https://supabase.com/dashboard** → sign in with GitHub.
2. Click the green **New project** button.
3. Fill in:
   - **Name:** `alwalaa-listings`
   - **Database password:** click **Generate a password**, then **Copy**, then paste somewhere safe.
   - **Region:** **Middle East (Bahrain)** — closest to Oman.
4. Click **Create new project**. Wait ~2 minutes for the spinner.

---

## Step 2 — Run the SQL

1. In Supabase, on the **left sidebar**, click the **SQL Editor** icon (looks like `>_`).
2. Click **+ New query** at the top.
3. Open this URL in a **new tab**:
   `https://raw.githubusercontent.com/humoodaladhary-sketch/business-ops-system/claude/ai-property-listing-agent-vD3E7/docs/DATABASE_SCHEMA.sql`
4. **Ctrl+A** to select all, **Ctrl+C** to copy.
5. Back in Supabase, **paste** into the SQL editor → click the green **Run** button (bottom right).
6. You should see **Success. No rows returned.**
7. Repeat steps 2–6 for the second file:
   `https://raw.githubusercontent.com/humoodaladhary-sketch/business-ops-system/claude/ai-property-listing-agent-vD3E7/docs/DEV_INVENTORY_SCHEMA.sql`

---

## Step 3 — Collect 3 Supabase keys

1. In Supabase, **left sidebar → ⚙ Settings → API**.
2. Copy these **3 values** into a notepad:

| Label on Supabase page | Save as |
|---|---|
| **Project URL** | `SUPABASE_URL` |
| **anon public** key | `SUPABASE_ANON_KEY` |
| **service_role** key (click "Reveal") | `SUPABASE_SERVICE_KEY` |

⚠️ Never share the `service_role` key.

---

## Step 4 — Anthropic key

1. Open **https://console.anthropic.com/settings/keys**.
2. **Create Key** → name it `alwalaa` → **Copy**.
3. Open **https://console.anthropic.com/settings/billing** → **Add credits** → **$10**.

---

## Step 5 — Deploy to Vercel

1. Open **https://vercel.com/new**.
2. Sign in with **GitHub** if needed.
3. Find **`business-ops-system`** in your repo list → click **Import**.
4. **You don't need to touch anything in the configure screen** — Vercel auto-detects Next.js because the app is at the repo root.
5. Scroll down to **Environment Variables**. Add these **5 rows**:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` from Step 4 |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from Step 3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your `anon` key from Step 3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | your `service_role` key from Step 3 |
   | `NEXT_PUBLIC_ALWALAA_WHATSAPP` | `+968 0000 0000` (your real number later) |

6. Click the **Branch** dropdown — pick **`claude/ai-property-listing-agent-vD3E7`** (or `main` if you've merged).
7. Click the big black **Deploy**.
8. Wait 3–5 minutes for the build. When you see **🎉 Congratulations**, click **Continue to Dashboard**.

---

## Step 6 — Test it

1. On the Vercel project page, click **Visit** (top right) — or copy the URL like `https://business-ops-system-xxx.vercel.app`.
2. Click **Dev Inventory** in the top nav.
3. Paste any sample inventory text into the **Ingest** box. Try this:

   ```
   AIDA - Building B:
   B-1204, 2BR apartment, 96 sqm, floor 12, partial sea view, OMR 108,500
   B-1205, 2BR apartment, 96 sqm, floor 12, partial sea view, OMR 112,000
   B-2101, 3BR penthouse, 220 sqm, top floor, sea view, OMR 425,000
   ```
4. Click **Normalize** → wait 20 seconds → see the preview diff → click **Confirm & commit**.
5. Switch to **Dashboard** tab → you should see KPI cards, price bands, and lowest-vs-highest comparisons.
6. Switch to **Generate** tab → pick a unit, EN or AR, click **Generate listing**.

If you see brand-aligned copy, the entire pipeline is live. 🎉

---

## If a step fails

| Symptom | Likely cause | Fix |
|---|---|---|
| Vercel build fails immediately | Missing env var | Vercel → Settings → Environment Variables → check all 5 are present → **Redeploy** |
| Build fails with "module not found" | Stale dependency cache | Vercel → Deployments → latest → ⋯ → **Redeploy without cache** |
| App loads but `/api/extract` 500s | Supabase schema not applied | Re-run both SQL files in Supabase SQL Editor |
| "Add an Anthropic API key" everywhere | `ANTHROPIC_API_KEY` missing or wrong | Verify in Vercel env vars, redeploy |
| 401 from Anthropic | Out of credit | Anthropic console → Billing → Add credits |

If you hit something not listed, paste the **last ~30 lines of the build log** (Vercel → Deployments → click failed deploy → expand logs) into the chat and I'll diagnose it.
