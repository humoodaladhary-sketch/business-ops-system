# CEO Command Center — the calc layer

**Status:** implemented, gate green
**Scope:** step 1 of the build order. `lib/calc.ts` and its tests only — no screens.

## What this is

Every formula the CEO Command Center will ever show lives behind `src/lib/calc.ts`.
The screens call it, the API calls it, nothing else implements any of it. It is pure:
no database calls inside any function, no framework imports, no `new Date()` reading
the wall clock — `asOf` is always passed in.

Run `npm run ceo:verify` to print the verified table straight out of the calc layer.

## Layout

| File | Holds |
|---|---|
| `src/domain/ceo/baisa.ts` | money as integer baisa |
| `src/domain/ceo/calendar.ts` | months, the Sun–Thu working week, pace |
| `src/domain/ceo/types.ts` | the domain model |
| `src/domain/ceo/cost.ts` | effective-dated cost policy, `personCost`, break-even |
| `src/domain/ceo/deals.ts` | `companyNet` and the derived rates |
| `src/domain/ceo/person.ts` | contribution, payback, trend, bonus bands |
| `src/domain/ceo/company.ts` | month state, projection, standings |
| `src/domain/ceo/csv.ts` | importing the deal book |
| `src/domain/ceo/seed.ts` | loading and validating the seed files |
| `src/lib/calc.ts` | the single public entry point |

Seed data lives in `data/ceo/` — people, cost policies, settings, provisions, and the
38-deal 2026 book. None of it is in code.

## Decisions worth knowing

### Money is integer baisa, never a float

1 OMR = 1000 baisa; every money field ends in `Baisa` and holds an integer. The seed
files store money as decimal *strings* so no float exists anywhere in the pipeline.

This is not theoretical. The source sheet records deal SHA-0002's agent cut as
`1704.363`. The exact answer is 4,869.610 × 35% = 1,704.3635, which rounds half-up to
`1704.364`. In binary floating point that same product is `1704.3634999999997`, which
rounds *down*. The sheet's `company_net_omr` column disagrees with its own components
by 2 baisa across the book for exactly this reason.

`companyNet()` therefore recomputes from components and the sheet's net column is kept
only for reconciliation. Both round to the same published OMR figure, and the 2-baisa
divergence is asserted in the tests rather than absorbed silently.

### The cost model is rows, not an if-statement

Two `CostPolicy` rows, `informal-2026-01` and `statutory-2026-09`. The policy for a
month is resolved from its `effectiveFrom` date. Running the same table from September
produces higher costs automatically because the policy changed — not because a constant
did. When the rules change again it is a row, not a deploy.

Effective dating is tested directly: a salary raised in September leaves August's cost
and August's ROI byte-identical.

### Who is Omani and who is expatriate was derived, not assumed

The brief gives the September payroll increase (+343.50 OMR) and the wage re-basing
exposure (97.75 OMR/month) but never says which staff carry social insurance and which
carry end-of-service accrual. Exactly one assignment satisfies both figures at once:

- **Social insurance, 11.5% of basic** — Humood, Shatha, Khalid, Safaa, Abeer, Suleiman
  (2,900 basic × 11.5% = **333.50**)
- **End-of-service, basic ÷ 12** — Wesam, Alex (120 ÷ 12 = **10.00**)
- **Neither** — Abdulahad, Abdullah (contractors)

Total **343.50**. Re-basing those six on total wage instead of basic adds
850 × 11.5% = **97.75**/month, ~1,173/year. Both are asserted in the tests, so if the
classification is ever wrong the published figures stop reproducing.

Pasha and Yousef are `Unclassified`: both left before September, so their class cannot
affect any figure. `payrollClassificationGaps()` surfaces anyone unclassified who is
employed under a statutory policy, so "unknown" never quietly passes as "nil".

### Break-even is a run rate, not a historical cost

The published payroll of 4,650.00 is today's ten active people. January actually cost
5,300.00 — Pasha and Yousef were still on the books. These are different questions, so
they are different functions:

- `fixedCostForMonth()` — what a month actually cost, including people who have since left
- `runRateFixedCost()` — what the roster active today costs under a given policy

Break-even uses the run rate. Reporting the historical figure as break-even would
overstate the volume the company needs.

### Pacing is on working days

Oman works Sunday–Thursday. By Thursday 5 February 2026 a quarter of the month's
working days are done, but only 5 of 28 calendar days — calendar pacing would project
the month 40% high. Pace is suppressed entirely before working day 3, where one deal
swings the index wildly; callers must render "لم يبدأ القياس / not yet measurable"
rather than a number.

### A role only shows the metrics it owns

`isRevenueScored()` is true only for advisors and the owner. For everyone else the
revenue metrics return **null**, not zero — a "0 deals" on a marketing manager's card
is a bug, not a fact. Their cost is always shown, because the CEO needs the full cost
picture.

The founder is a further special case: his pay is an `ownerDistribution`. It stays in
payroll, fixed cost and break-even, because the company genuinely pays it, but
`companySummary` reports it separately and he never appears in the advisor standings.

### Nothing is invented to fill a space

- Seven unpriced cost items carry `amountBaisa: null` and surface as a visible gap.
- The retroactive social-insurance provision carries no amount and the flag
  "amount unknown — confirm with SPF".
- Wage re-basing is computed as a scenario, never booked as a cost.
- `ratio()` returns null rather than `Infinity` when the denominator is zero.
- Departed people stay in the record. Dropping Pasha and Yousef would lift the
  company's return from 1.8× — which is why the test asserts it does.

### The importer refuses rather than skips

An unrecognised advisor, a duplicate reference, a missing column, an unknown stage, or
a fourth decimal place all throw. A silently dropped row is a number that is wrong in a
way nobody notices.

## Verified against

The CEO's published table, measured 2026-01-01 → 2026-08-25, reproduces exactly:
all twelve people, the company row (38 deals · 3,091,226 volume · 69,556 in ·
38,950 cost · +30,606 · 1.8×), both derived rates (3.6338% / 2.2501%), both break-even
figures (231,122 / 246,388), the referral liabilities (1,969.20 + 1,085.00 = 3,054.20),
and the payback months (Shatha January · Wesam January · Alex February · Humood not yet).

## Audit findings (fixed)

An adversarial pass over the parts the acceptance test does not reach found four
real defects. None moved a published figure; all four are locked by regression tests.

1. **The referral comes off the top before the advisor's cut.** `expectedAgentAmount`
   computed the cut on gross, which is wrong for referred deals and flagged both of
   them as errors. Both referral deals confirm the real rule exactly: HUM-0004 is
   50% of (3,938.400 − 1,969.200) = 984.600, HUM-0005 is 50% of
   (2,170.000 − 1,085.000) = 542.500.

2. **A collected deal was listed as awaiting an invoice.** HUM-0004 has been paid but
   its invoicing state was never recorded, so it appeared on the "invoices to send"
   tick-list. `awaitingInvoice` now excludes anything already collected.

3. **The founder was being measured against the advisor bonus scheme.** His card
   showed "band: above target" — a bonus that does not exist, against a quota he was
   never set. `isBonusEligible` is now advisors only; his volume and projection are
   still shown, per the brief.

4. **A negative month fell into no bonus band at all**, rendering as "no band" rather
   than "no bonus". The lowest band now catches anything beneath it.

The same pass surfaced a **data-quality finding, not a code defect**: two of Alex's
deals (ALE-0002, ALE-0003) record an agent cut of unit value ÷ 120 rather than 25% of
gross — **58.416 OMR** of under-paid advisor cut. `agentCutAnomalies()` reports it.
The published figures are untouched: the recorded amounts are what was actually paid.

## What is deliberately not here

Screens. Per the build order, nothing else starts until this passes — and it does.
Next is the schema, seed and settings (step 2), then the person card (step 3).
