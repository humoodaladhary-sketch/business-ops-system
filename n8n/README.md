# Alwalaa Copilot — n8n webhook (no key in the app)

This runs the department copilots' AI through the **Anthropic connection you already
have in n8n**, so no API key lives in Vercel or Supabase. The app just calls this
webhook; n8n adds the key and returns the answer.

## Import (about 2 minutes)

1. In n8n: **Workflows → Import from File** → choose
   `alwalaa-copilot-webhook.workflow.json`.
2. Open the **Call Anthropic** node and confirm the credential is your
   **Anthropic account** (it is pre-linked by ID; re-select it if n8n asks).
3. Click **Active** (top-right toggle) to publish it.
4. Open the **Copilot Webhook** node and copy the **Production URL**. It looks like
   `https://<your-n8n-host>/webhook/alwalaa-copilot-3ba2c091638d3c85`.

## Point the app at it

Set one value so the app uses the webhook (either works):

- **Vercel env var:** add `COPILOT_WEBHOOK_URL` = the Production URL, then redeploy, **or**
- **Tell me the URL** and I will hard-code it as the default (no Vercel change, no redeploy).

That's it — every department copilot then answers through your n8n Anthropic
connection. The live-data dashboards already work with no key at all.

## What the webhook does

`POST { system, model, max_tokens, messages }` → calls the Anthropic Messages API
with your credential → returns the raw Anthropic response. The app
(`src/lib/copilot.ts`) grounds each request with the department's live snapshot
before sending, and extracts the reply text from the response.

## Security note

Access is gated by the unguessable webhook path (same model as the Supabase sync
token). If you want stronger protection later, add Header Auth on the webhook node
and a matching header in `src/lib/copilot.ts`.
