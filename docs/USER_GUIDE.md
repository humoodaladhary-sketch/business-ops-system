# Alwalaa CRM — How to use it

A practical guide for the CEO/admin and for advisors. The system runs in your
browser; sign in and use the top navigation to move between sections.

---

## 1. Signing in

Open the app — you land on the **sign-in screen**.

- **Continue as CEO / Admin** — full access to everything (all leads, all deals,
  all agents, assignment board, analytics).
- **An advisor's name** (Shatha, Alex, Pasha, Wesam, Khalid, Tariq) — that
  advisor's view: only *their* leads, deals, commissions and workspace, plus the
  shared leaderboard.

Use **Sign out** (top-right) to switch identities.

> This is the preview login. In production it becomes Supabase email sign-in with
> the same roles (see §6).

---

## 2. The map — what each page is for

| Page | Who | What it shows |
| :-- | :-- | :-- |
| **Overview** (Thursday view) | All | Team pace vs target, who's ahead/behind, accountability flags, live tier-progress cards. Your Thursday 4 PM check. |
| **Leads** | All (scoped) | Every lead with contact, **country code & flag auto-detected**, nationality, budget, normalized stage. Search + filter. Advisors see only their own. |
| **Pipeline** | All | The canonical funnel (New → … → Closed) with counts. Shows how messy source stages were normalized. |
| **Deals** | All (scoped) | Every closing — developer rate, commission, **dev-paid / agent-paid** status, payment-voucher #, totals. |
| **Performance** | All | Volume vs target chart + each advisor's live tier-progress and next-tier nudge. |
| **Analytics** | All (ranking shared) | **Agent ranking** (by volume / deals / earned / pending) and a **time breakdown** (per month / week / day) of closings & commission, with **earned vs. to-be-received**. |
| **Leaderboard** | All | Standings + Agent of the Month, overachievers, streaks. |
| **Agents** (admin) / **My Workspace** (advisor) | Scoped | Per-agent page: KPIs, monthly breakdown, their leads & deals, and **links to their Google Drive folders** to view/edit/add/upload documents. |
| **Agent Portal** | All (scoped) | Lead assignment + the **10-minute basket** (see §4). |

---

## 3. Daily workflows

### CEO / Admin
1. **Overview** — glance at team pace and the **Accountability** panel (Watch / At Risk).
2. **Agent Portal → Assignment board** — assign incoming leads to advisors.
3. **Deals** — see what closed and what commission is still **awaiting the developer** or **unpaid to the agent**.
4. **Analytics** — rank the team, drill into any agent's month/week/day, track receivables.

### Advisor
1. **Agent Portal → My basket** — **Accept** new leads within 10 minutes (or **Pass**). Accepted leads move to *Working*; update their **stage** there.
2. **My Leads** — work your pipeline; see contact + country at a glance.
3. **My Deals** — track your closings and whether you've been **paid**.
4. **Overview / Leaderboard** — see where you stand and your **next-tier nudge**
   ("close X more to move 35% → 40% and earn ~Y more").

---

## 4. The 10-minute basket (lead routing)

- The CEO assigns a lead → it lands in the advisor's **basket** with a live countdown.
- **Accept** within 10 minutes to claim it; **Pass** to release it.
- If it isn't accepted in time, it **auto-routes to the next advisor** in the rotation.

---

## 5. Key concepts

- **Canonical pipeline** — every agent's inconsistent labels (e.g. the "Closing
  stage" catch-all) are normalized to one funnel so numbers are comparable.
- **Commission model (date-aware)** — the **legacy** structure (25% advisor · 35%
  senior · 50% own/referral + head-of-sales override) applies through **June 2026**.
  The **25/35/40/50 performance ladder** (split set by % of monthly target) activates
  **1 July 2026** — preview it now on Performance.
- **Earned vs. receivable** — *Earned* = commission already paid to the agent;
  *Pending* = booked, not yet paid; *Receivable* = developer commission Alwalaa is
  still owed.
- **Former staff** — kept for records/insight (e.g. Yousef) but excluded from
  active rankings and routing.

---

## 6. Editing data today, and going fully live

**Today (baked snapshot):** the data is consolidated from your Drive sheets. To
add/edit, use the **Drive folder links** on each agent's workspace page (their CRM
sheet, closed-deal docs, payment vouchers).

**To go fully live** (so edits flow in automatically and each person logs in):

1. **Database** — create a Supabase project; set `DATABASE_URL` / `DIRECT_URL`;
   run `pnpm db:migrate` and `pnpm db:seed`.
2. **Auth** — set `AUTH_PROVIDER=supabase` + `NEXT_PUBLIC_SUPABASE_URL` +
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`; run the RLS migration in `supabase/migrations`;
   set each user's `app_metadata` `role` + `agent_id`.
3. **Google Sheets sync** — add a read-only service account
   (`GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`) so leads/deals refresh continuously.
4. **Alerts** — point `ALERT_WEBHOOK_URL` at an n8n flow → WhatsApp (Respond.io).

Everything is built to switch over by configuration — no code changes needed.
