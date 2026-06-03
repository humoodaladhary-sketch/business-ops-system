# Alwalaa Real Estate — Advisory CRM

Internal, production-grade CRM for **Alwalaa Real Estate** (Muscat, Oman): consolidates
the individual agent Google Sheets into one source of truth for leads, agent
performance, deals, commissions, and **performance-based payouts**.

> Built in phases from a real data audit. See [`docs/phase-0-data-audit.md`](docs/phase-0-data-audit.md)
> for the field-by-field audit of the live agent sheets that drove this design.

### Tailored for Alwalaa — what's wired

- **Official logo** (white lockup + emblem, pulled from the brand Drive) in the nav + favicon.
- **Real team data** consolidated from every agent's Drive sheet — Shatha, Alex, Pasha, Wesam
  (+ Yousef head-of-sales override) deals, with developer rate, commission, **payment-voucher #**
  and **dev-paid / agent-paid** status.
- **Leads** page: all leads consolidated and organized — contact, **country code & country
  auto-detected from the phone**, nationality, budget, source, normalized stage, assigned agent.
- **Per-agent workspaces** (`/agents/[id]`): each advisor's leads, deals, KPIs and direct links
  to their Drive folders to **view / edit / add / upload** sheets and documents.
- **Agent Portal + 10-minute basket** (`/portal`): the CEO assigns leads; each lands in the
  agent's basket with a **live 10-minute countdown** — Accept to claim, Pass to release, or it
  **auto-routes to the next advisor**. Agents update lead progress here.
- **Date-aware comp**: the **legacy** structure (25% advisor · 35% senior · 50% own/referral +
  head-of-sales override) stays in force until **1 July 2026**, when the 25/35/40/50 performance
  ladder takes over (previewable now).

---

## What it does

- **Ingest** messy agent sheets (Google Sheets API + day-one CSV fallback), validate
  every row with Zod, **reject-and-log** bad rows, append-only staging.
- **Normalize** each agent's inconsistent stage labels to one canonical pipeline.
- **Run a monthly, performance-based commission engine** — the core of the system.
- **Auto-flag** underperformers (Watch / At Risk) and **auto-reward** top performers.
- **Dashboards**: Thursday pace view, leaderboard, performance vs target, the live
  **tier-progress widget**, lead pipeline, and commission/payout tracking — all branded.

## Resolved business decisions (drive the schema + engine)

1. **Hybrid commission split** — the 25/35/40/50 performance ladder (by % of monthly
   target) sets the rate, but own/referral leads keep a **50% source floor**:
   `agentSplitRate = max(ladderRate, sourceFloor)`.
2. **Multi-agent deal attribution** — a deal can credit several agents; volume **and**
   payout split by share (`DealAttribution`).
3. **Month attribution** by `Deal Closed On` (close date), not reservation date.
4. **Developer rate** is **tier-ready** (cumulative quarterly volume) but **seeded flat**
   (Ahly Sabbour 3.5%, Sarooj 4%, Muriya / Al Abrar / Adante 3%).

## Tech stack

Next.js 14 (App Router) · TypeScript · Prisma + Postgres (Supabase) · Tailwind +
custom UI · Recharts · Zod · googleapis · Vitest. Money is `Decimal(18,3)` (OMR baisa);
**no floats touch commission math**.

## Clean architecture

```
src/
  domain/          Pure-TS entities + commission rules engine (NO framework imports)
    money.ts         exact OMR-decimal arithmetic
    commission/      ladder · sourceFloor · developerRate · payout · engine
    atRisk.ts  rewards.ts  kpi.ts  stage.ts
    __tests__/       full unit coverage (tier boundaries, provisional→final, …)
  application/     Use cases (computeMonthlyPerformance, evaluateAtRisk, buildLeaderboard)
                   over repository ports
  infrastructure/  Prisma repositories · CsvAdapter · GoogleSheetsAdapter · Zod · parsers
  app/             Next.js routes, server components, branded dashboards, alert APIs
prisma/            schema.prisma · seed.ts
```

The commission engine lives entirely in `/domain` as a **configurable rules engine** —
rates, tiers, thresholds and splits all come from config tables, never hardcoded.

## Getting started

```bash
pnpm install
cp .env.example .env          # fill DATABASE_URL / DIRECT_URL (Supabase) etc.

pnpm db:migrate               # create the schema
pnpm db:seed                  # ladder, floors, developers, projects, agents, targets, stage maps
pnpm dev                      # http://localhost:3000
```

The dashboards render **out-of-the-box without a database** using a demo dataset
(`src/app/_data/demo.ts`) built from the real audited Feb-2026 deals and run through the
actual domain engine. Wire the Prisma repositories (`src/infrastructure/prisma`) once
`DATABASE_URL` is set to switch to live data.

### Scripts

| Command | What |
| :-- | :-- |
| `pnpm test` | Vitest — domain engine + ingestion parsers (71 tests) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | `prisma generate` + `next build` |
| `pnpm db:seed` | Seed all config + roster |

### Ingestion

- **CSV (day one):** `POST /api/ingest` with a `My Deals Status` CSV export → returns a
  validation summary and the logged rejects. Handles money-as-text (`"43,500.00  OMR "`),
  mixed M/D vs D/M dates, `#VALUE!` cells, decorative header rows, and footer aggregates.
- **Google Sheets:** `GoogleSheetsAdapter` reads a tab via a read-only service account
  (`GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`) and reuses the same validation path.

### Alerts (Phase 5)

`POST /api/webhooks/at-risk` fans an at-risk/milestone event out to `ALERT_WEBHOOK_URL`
(e.g. an n8n flow → WhatsApp via Respond.io). No-ops cleanly when unset.

## The commission engine (most sensitive code)

```
attributedValue = dealValue × attributionShare
alwalaaGross    = attributedValue × developerRate          (developer → Alwalaa)
ladderRate      = ladder tier from whole-month % of target (retroactive)
agentSplitRate  = max(ladderRate, leadSourceFloor)         (hybrid floor)
agentPayout     = alwalaaGross × agentSplitRate
```

Payouts are **provisional** during the month (recomputed on every close) and **lock to
final** at month-close. Every tier boundary and the provisional→final transition are unit
tested (`src/domain/__tests__`).

## Phase status

- ✅ **Phase 0** — Data audit (`docs/phase-0-data-audit.md`)
- ✅ **Phase 1** — Prisma schema + migrations + seed
- ✅ **Phase 2** — Ingestion + normalization (CSV + Sheets, Zod, staging, stage/alias maps)
- ✅ **Phase 3** — Commission engine in `/domain` with full unit-test coverage
- ✅ **Phase 4** — Branded dashboards (Thursday view, leaderboard, performance, pipeline, commissions, tier widget)
- ✅ **Phase 5** — Alert/automation API (at-risk webhook) ready for n8n + WhatsApp
- ⏭️ **Phase 6** — Supabase auth + Row-Level Security (agents see own data + leaderboard; CEO sees all)

## Brand

Dark `#1E1E1E`, gold `#C9A052`, white text · Cormorant Garamond (headings) / Inter (body).
Swap the placeholder mark in `src/app/components/Nav.tsx` for the supplied logo.
