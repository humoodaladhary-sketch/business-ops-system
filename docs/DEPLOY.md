# Deploy the Alwalaa AI Listing Agent

Two services, both free tier, both beginner-friendly:

1. **Supabase** — database, file storage, authentication (free: 500MB DB, 1GB storage).
2. **Vercel** — hosts the Next.js app, auto-deploys from GitHub (free: generous).

End state: a private URL like `alwalaa-listings.vercel.app` that only you and your invited team can access, backed by an Oman-scale database.

Total setup time: **about 25 minutes** the first time.

---

## Before you start

You'll need:

1. **GitHub account** with the repo `humoodaladhary-sketch/business-ops-system`.
2. **Anthropic API key** — https://console.anthropic.com/settings/keys → Create Key → copy it (starts with `sk-ant-...`).
3. **Supabase account** — https://supabase.com/dashboard → sign up with GitHub.
4. **Vercel account** — https://vercel.com/signup → sign up with GitHub.

---

## Step 1 — Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**.
2. Name it `alwalaa-listings`. Pick a strong DB password (save it!). Region: **Middle East (Bahrain)** is closest to Oman.
3. Wait ~2 minutes for the project to provision.
4. Once ready, click **SQL Editor** in the left nav.
5. Open the file `docs/DATABASE_SCHEMA.sql` in this repo, copy the entire contents, paste into the SQL editor, click **Run**. You should see "Success. No rows returned."
6. Left nav → **Storage** → **New bucket** → name it `alwalaa` → **private** (not public) → Create.
7. Left nav → **Settings → API**. Copy these three values into a notepad (you'll paste them into Vercel in step 3):
   - Project URL (looks like `https://xxxxx.supabase.co`)
   - `anon` public key (long JWT)
   - `service_role` key (long JWT — **keep this secret**)

---

## Step 2 — Push the code (already done if you're reading this on the branch)

The code is on branch `claude/ai-property-listing-agent-vD3E7`. You can deploy from that branch directly, or merge into `main` first:

- Go to https://github.com/humoodaladhary-sketch/business-ops-system/pulls
- New PR: base `main`, compare `claude/ai-property-listing-agent-vD3E7` → Create → Merge.

---

## Step 3 — Deploy to Vercel

1. Go to https://vercel.com/new.
2. Click **Import Git Repository** → find `humoodaladhary-sketch/business-ops-system`.
3. You'll see a **Configure Project** screen. Very important:
   - **Root Directory** → click **Edit** → choose **`web`** (the Next.js app lives there).
   - **Framework preset** should auto-fill to **Next.js**.
4. Click **Environment Variables** (expandable). Add these 5:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (your Anthropic key) |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key |
   | `NEXT_PUBLIC_ALWALAA_WHATSAPP` | e.g. `+968 xxxx xxxx` |

5. Click **Deploy**. Wait 2–4 minutes.
6. When build finishes you land on the app's Vercel page. The URL at the top (e.g. `https://alwalaa-listings.vercel.app`) is **your public link**.

---

## Step 4 — Add the logo

1. On your laptop, drop the Alwalaa logo PNG into `web/public/brand/alwalaa-logo.png`.
2. Commit and push to the same branch.
3. Vercel auto-redeploys in ~60 seconds.

(Until you do this, the header shows a tasteful `W و` placeholder.)

---

## Step 5 — First smoke test

1. Open your new URL in a browser.
2. Click **Upload** in the top nav.
3. Fill in a project name (e.g. `Sultan Haitham City — Phase 1`).
4. Drop in one Excel inventory + one brochure PDF.
5. Click **⚙ Extract units**.
6. You should see a JSON dump below in 30–90 seconds with the extracted units and project data.

If that works, the whole system is wired end-to-end. Next milestones persist the output to Supabase and give you the listing UI.

---

## Troubleshooting

**"Extraction failed: Missing Supabase env vars"**
You forgot one of the env vars in step 3.4. Vercel → your project → **Settings → Environment Variables** → add the missing one → **Redeploy**.

**"Extraction failed: 401 from Anthropic"**
Your Anthropic key is invalid, expired, or the account has no billing credit. Go to https://console.anthropic.com/settings/billing and add $5–10.

**"Build failed: pdf-parse not found"**
Should not happen with the current package.json — if it does, in Vercel Settings → General → Node.js Version → set to **20.x** and redeploy.

**"I see the page but the Upload button does nothing"**
Open the browser's developer console (F12 → Console tab) — most issues surface there. Paste the error into the chat and I'll help.

**I want a custom domain**
Vercel → project → **Settings → Domains** → add `app.alwalaa.om` → follow DNS instructions.

**I want to restrict access to just my team**
Supabase Auth + Vercel middleware — planned for Milestone M5 in the build plan.

---

## Running it locally (optional)

If you'd rather develop on your laptop:

```bash
cd web
npm install
cp .env.example .env.local   # fill in the 5 env vars from step 3
npm run dev
```

Open http://localhost:3000.
