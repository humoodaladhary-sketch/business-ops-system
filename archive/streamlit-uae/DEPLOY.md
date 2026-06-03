# Deploy the Listing Studio — beginner guide

You'll get a public URL like `https://alwalaa-listings.streamlit.app`
that you can open from any phone or computer. It's free, no credit card.

Total time: **about 10 minutes**.

---

## What you need before you start

1. A **GitHub account** — sign up at https://github.com/signup if you
   don't have one. Use the same email you used for this project if
   possible.
2. An **Anthropic API key** — sign up at https://console.anthropic.com,
   then go to https://console.anthropic.com/settings/keys and click
   **"Create Key"**. Copy the key (starts with `sk-ant-...`) and paste it
   somewhere safe — you'll need it in step 5.

---

## Step 1 — Make sure the code is on the main branch of your GitHub repo

The code currently lives on a branch called
`claude/ai-property-listing-agent-vD3E7`. Streamlit Cloud can deploy
straight from that branch, so you don't have to merge it if you don't
want to. But if you'd rather have it on `main`:

1. Go to https://github.com/humoodaladhary-sketch/business-ops-system
2. Click the **"Compare & pull request"** banner at the top, or:
3. Click **"Pull requests"** → **"New pull request"**
4. Set **base: `main`**, **compare: `claude/ai-property-listing-agent-vD3E7`**
5. Click **"Create pull request"** → **"Merge pull request"** → **"Confirm merge"**

If that feels intimidating, skip this — we'll deploy from the branch directly.

---

## Step 2 — Open Streamlit Community Cloud

1. Go to **https://share.streamlit.io**
2. Click **"Continue with GitHub"** (top right)
3. Sign in with the same GitHub account that owns the repo
4. Click **"Authorize Streamlit"** when GitHub asks

You'll land on the Streamlit dashboard.

---

## Step 3 — Create a new app

1. Click the **"Create app"** button (top right, blue)
2. Choose **"Deploy a public app from GitHub"**
3. You'll see a form with these fields — fill them in exactly:

| Field | What to type |
|---|---|
| **Repository** | `humoodaladhary-sketch/business-ops-system` |
| **Branch** | `claude/ai-property-listing-agent-vD3E7` (or `main` if you merged in step 1) |
| **Main file path** | `app.py` |
| **App URL** | `alwalaa-listings` (or whatever name you want — it becomes the URL) |

> Don't click "Deploy" yet — we need to add the API key first.

---

## Step 4 — Add your API key as a secret

Still on the same form:

1. Click **"Advanced settings…"** (small link at the bottom)
2. In the **Secrets** box, paste exactly this — replacing the placeholder
   with your real key from earlier:

   ```
   ANTHROPIC_API_KEY = "sk-ant-paste-your-real-key-here"
   ```

3. Click **"Save"**.

---

## Step 5 — Deploy

1. Click the big blue **"Deploy"** button.
2. Wait 2-4 minutes. You'll see logs scrolling — Streamlit is installing
   Python packages on a fresh server. The first deploy is the slowest;
   future updates take ~30 seconds.
3. When it's done, the page reloads showing your live app.

The URL at the top of your browser is your **public link** — something
like:

> **https://alwalaa-listings.streamlit.app**

That's the link you can click, share with the team, bookmark, open on
your phone. Anyone with the link can use it.

---

## Step 6 — Test it works

1. In the sidebar, the API key field should already be filled (greyed
   out as dots) — that's the secret you saved.
2. Go to the **Single property** tab.
3. The form is pre-filled with sample data — just click **"✨ Generate
   listings"** at the bottom.
4. After about 30-60 seconds the **Generated listings** tab will show
   tabs for each platform (website, instagram, dubizzle, etc.) in
   English and Arabic.

If you see results, you're done. 🎉

---

## Updating the app later

Any time you (or this assistant) push new code to the same branch on
GitHub, Streamlit redeploys automatically within ~30 seconds. No clicks
needed.

To redeploy manually: go to your app's page on
https://share.streamlit.io and click **"Reboot app"** in the menu
(three dots top-right).

---

## Common issues

**The app says "Add an Anthropic API key in the sidebar to start."**
You skipped step 4, or the secret was saved with the wrong format.
Go to your app's **Settings → Secrets**, paste:
`ANTHROPIC_API_KEY = "sk-ant-..."` (with the quotes), save, reboot.

**Deploy logs show "ModuleNotFoundError"**
Check that `requirements.txt` is in the repo root — it should be, this
project ships with it.

**The app loads but generation fails with "401 Unauthorized"**
Your API key is invalid or expired. Generate a new one at
https://console.anthropic.com/settings/keys and update the secret.

**You want to take the app offline**
Streamlit Cloud → your app → **Settings → Delete app**. The repo stays
on GitHub.

---

## Alternative hosts

If Streamlit Cloud doesn't suit you, the same code deploys to:

- **Railway** (https://railway.app) — $5/mo free credit. New project
  → "Deploy from GitHub" → set start command to
  `streamlit run app.py --server.port=$PORT --server.address=0.0.0.0`,
  add `ANTHROPIC_API_KEY` env var.
- **Render** (https://render.com) — free tier sleeps after inactivity.
  New Web Service → same repo, same start command, same env var.
- **Hugging Face Spaces** (https://huggingface.co/new-space) — pick
  "Streamlit" SDK, link the GitHub repo, set the secret.

If you want me to add a one-click config file for any of these, ask.
