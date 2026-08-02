# Investment Intelligence & ROI Analyzer — architecture and implementation plan

Feature doc for the Pro Mode **Invest** module: deterministic deal analysis,
rental-strategy comparison, objective qualification, offer-price solving, and
the AI-assisted investment report. Dated 2026-08-02.

## 1. Existing architecture (inspection summary)

| Layer | What exists |
| --- | --- |
| Framework | Next.js 14 App Router (`next ^14.2.5`), React 18, TypeScript strict, Tailwind 3 |
| Domain | Pure, tested modules under `src/domain/` — `realestate/calculators.ts` (yield, appreciation, payment plan, mortgage, residency, commission), `realestate/offer.ts` (client-safe offer, Markdown render), `realestate/compare.ts`, `money.ts` (decimal.js, OMR 3 dp) |
| Pro Mode | `/war-room` — `WarRoomClient` tabs: Offer, Compare, Calculators, ITC Map; live units via `loadLiveOfferUnits()` (service-role Supabase, available + priced + matched only) |
| Data | System of record = Supabase SQL (`supabase/migrations/0000–0009`, snake_case, `organization_id` tenancy, RLS). Prisma is a parallel/fallback model. Truth rule: only rows with `external_id` are business data |
| Migrations | Numbered reversible pairs `NNNN_name.up.sql` / `.down.sql`, applied via the Supabase SQL editor |
| Auth | Owner-only mode: `getSession()` returns the hardcoded ADMIN owner; API routes still self-enforce (`getSession` + capability flags from `src/domain/access.ts`); machine endpoints use shared tokens |
| AI | No SDK — raw `fetch` to Anthropic Messages API (`src/lib/copilot.ts`), model `ANTHROPIC_MODEL || claude-sonnet-5`, credential ladder (Vercel key → n8n webhook → Supabase edge fn), 6-step tool loop, guarded writes (`confirm: true`), `ChatResult` union `ok | setup | error` |
| Reports | `/reports` cream print sheet + `PrintButton` (`window.print()`), print CSS |
| Design | `ink` near-black surfaces, `gold` CSS var (recolours to crimson in Pro Mode — the "deep red"), `hairline` borders, `cream` report sheet, `Card`/`Badge`/`StatTile`/`SectionTitle`/`ProgressBar` primitives, `formatOMR`/`formatPct` |
| Testing | vitest 2 (`src/**/*.test.ts`, node env), colocated test files, exact-value assertions on hand-computed fixtures, 183 tests green before this feature |
| Gate | `pnpm typecheck` + `pnpm test` + `pnpm build` — must stay green |

## 2. What this feature adds

A fifth Pro Mode tab, **Invest**, plus a pure calculation engine and a
persistence + report layer:

```
src/domain/realestate/investment/   ← Level-1 backbone (pure, fully tested)
  provenance.ts    data-provenance model + data-quality scoring
  assumptions.ts   configurable Oman fee assumptions (source + effective date)
  acquisition.ts   acquisition costs, cash required, per-m² figures
  financing.ts     amortization engine (grace, interest-only, balloon, monthly/quarterly)
  rental.ts        daily / monthly / annual strategy engines + time-share blending
  metrics.ts       yields, cap rate, CoC, DSCR, debt yield, break-evens, IRR, NPV, MIRR,
                   payback, equity multiple, CAGR — null (never 0) for undefined ratios
  projection.ts    1–30-year cash-flow model (annual/monthly rows, off-plan handover,
                   payment-plan outflows, escalation, capex, exit via appreciation or exit cap)
  objectives.ts    investment-objective qualification (criteria pass/fail/distance,
                   weighted explainable 0–100 score, confidence, insufficient-data honesty)
  offerSolver.ts   reverse price solver (closed-form + bisection) → justified price,
                   opening offer, negotiation range, walk-away
  scenarios.ts     conservative/base/optimistic presets, custom deltas, one-way
                   sensitivity tables, ranked variable impact (tornado)
  comparables.ts   comparable-set statistics (median/avg psm, premium/discount, confidence)
  analyze.ts       orchestrator → one structured InvestmentAnalysisResult JSON
                   (with per-metric explain steps)
```

- **UI** — `src/app/war-room/_components/invest/` guided sections (Property →
  Purchase → Rental → Financing → Objectives → Results → Report) with live
  inventory prefill, scenario chips, sensitivity table, recharts cash-flow
  chart, explain-calculation popovers, transfer-to-Offer.
- **Persistence** — migration `0010_investment_analysis` creating
  `investment_analyses` (jsonb assumptions + result snapshot, versioned,
  org-scoped, RLS) — reports stay reproducible after unit data changes.
- **API** — `POST/GET /api/invest/analyses` (save/list/load, zod-validated,
  session + capability checked, audited), `POST /api/invest/report`
  (AI narrative from the structured result only, guardrailed).
- **Report** — internal and client-safe variants rendered from the saved
  structured result; print/PDF via the existing print-sheet pattern. The
  client-safe type contains no commission, internal notes or negotiation
  strategy fields by construction (same trick as `Offer`).

## 3. Decisions

| # | Decision | Why |
| --- | --- | --- |
| 1 | All financial figures come from the deterministic engine; the AI layer only narrates a structured JSON result it cannot extend with numbers | Task requirement; repo guardrail style ("deterministic … never the model") |
| 2 | Undefined ratios return `null`, never 0 | Mirrors `no_touch_recorded` / `due_date_unverified` honesty rule |
| 3 | Whole-percent convention (`7.5 = 7.5%`) for engine inputs/outputs with `Pct` suffix | Matches `calculators.ts`; fractions only in clearly-named legacy fields |
| 4 | Government fees are configurable assumptions with source + effective date (`assumptions.ts`), never hardcoded facts | Task requirement §4 |
| 5 | Location intelligence reuses the ITC map's zone/project data + verified anchor distances only; market-rate layers show "insufficient data — manual input required" until a provider or import supplies sourced figures | No fabricated market data (§12) |
| 6 | Analyses persist as jsonb snapshots (inputs + result + versions) keyed to org, not as 20 normalized tables | Reproducibility requirement §18 with the repo's pragmatic schema style; normalized tables can follow when query patterns demand them |
| 7 | Monte Carlo deferred (per task §11 it is phase-2 after deterministic work is proven) | Scope control |

## 4. Formula reference

Formulas are documented as JSDoc on each function (the code is the canonical
spec) and every result carries explain steps. Summary:

- Gross yield = annual gross rental income / price
- EGI = gross scheduled income − vacancy loss + other operating income − revenue-based fees (short-let)
- NOI = EGI − operating expenses
- Cap rate = NOI / value · Cash-on-cash = annual pre-tax cash flow / total cash invested
- DSCR = NOI / annual debt service · Debt yield = NOI / outstanding loan
- Break-even occupancy (strategy-aware linear model) = (fixed opex + debt service) / (fee-net EGI − occupancy-variable opex) × assumed occupancy — keeps platform/tourism revenue shares in the equation; values > 100% mean the deal cannot break even
- Equity multiple = total cash distributions / total equity invested
- IRR: bisection on NPV sign change over [−99.9%, 1000%], null when no sign change
- MIRR = (FV(positives @ reinvest) / −PV(negatives @ finance))^(1/n) − 1
- Payback: first cumulative recovery to ≥ 0 after capital was at risk; never-negative flows → 0; never recovered → null (a set max-payback objective treats null as FAIL, not missing data)
- Amortizing payment (balloon-aware, balloon clamped to the outstanding balance): (P − B·(1+i)⁻ⁿ)·i / (1 − (1+i)⁻ⁿ)
- Exit (cap method) = forward NOI / exit cap; net proceeds = exit value − selling costs − loan balance − remaining developer-plan instalments (an early exit settles the unpaid price from the sale — no phantom profit on off-plan flips)

## 5. Environment variables

No new variables. The AI report reuses the copilot credential ladder
(`ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / `COPILOT_WEBHOOK_URL` /
`DEPT_API_TOKEN`) and persistence reuses `SUPABASE_SERVICE_ROLE_KEY`. Without
a database key the Invest tab still works fully in-session (manual entry, no
save); without an Anthropic key the report shows the standard setup notice.

## 6. Using the Invest tab (user guide)

1. **Property** — pick a unit from live inventory (facts marked VERIFIED) or
   enter one manually (marked ASSUMED). Latitude/longitude unlock landmark
   distances.
2. **Purchase & costs** — asking/negotiated price plus itemized one-off costs;
   "Apply standard Oman assumptions" fills sourced defaults you then confirm.
3. **Rental strategies** — enable daily, monthly and/or annual, enter income
   and operating costs, choose which strategy (or a blend) drives the numbers.
4. **Financing** — cash, mortgage (LTV, rate, term, grace, interest-only,
   balloon, quarterly) or the developer plan for off-plan units.
5. **Hold, exit & objectives** — hold period, growth assumptions, exit method,
   and the measurable targets that define "a good deal" for this investor.
6. **Comparables & location** — paste CSV/JSON comps or add them manually,
   with source + provenance on every row.
7. **Results** — verdict badge + explainable score, KPI grid, offer-price
   table ("To Offer" hands the chosen price to the Offer builder), scenarios,
   sensitivity, criteria pass/fail, "Explain the calculations".
8. **Report** — internal or client-safe sheet, optional AI narrative
   (EN/AR, needs a saved analysis), Print/PDF. Save/duplicate/history in the
   toolbar; each save is recomputed and versioned server-side.

Migration to apply once in the Supabase SQL editor:
`supabase/migrations/0010_investment_analysis.up.sql` (reverse:
`0010_investment_analysis.down.sql`).

## 7. Phase log

- **Phase 1** — this document.
- **Phase 2** — engine modules + 105 unit tests (`src/domain/realestate/investment/`).
- **Phase 3** — migration 0010, `/api/invest/*` routes, audit logging.
- **Phase 4–5** — Invest tab UI, prefill, objectives, solver, scenarios, sensitivity.
- **Phase 6** — location signals + comparables import with provenance.
- **Phase 7** — AI narrative + internal/client-safe report + print export + history.
- **Phase 8** — adversarial engine review (11-agent workflow): 2 critical + 5
  major findings confirmed by execution and fixed with regression tests —
  early-exit plan obligations, short-let break-even fees, lender fees in cash,
  payback semantics, monthly-row reconciliation, explain-equation accuracy.
  Gate green (typecheck + 317 vitest + build); no regression in Offer /
  Compare / Calculators / ITC Map (untouched code paths + full suite).

## 8. Changelog

- **2026-08-02** — Investment Intelligence & ROI Analyzer shipped: Invest tab
  in Pro Mode, deterministic engine (formula v1.0.0), objective
  qualification, offer-price solver, scenarios & sensitivity, comparables
  import, location signals, internal/client-safe reports with AI narrative,
  migration 0010.
