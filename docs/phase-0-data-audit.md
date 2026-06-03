# Phase 0 — Data Audit

**Alwalaa Real Estate CRM consolidation**
Audit date: 2026-06-03
Sources audited: live agent Google Sheets pulled from the shared CRM Drive folder.
Status: **awaiting CEO approval before any schema is written (Phase 1).**

> Purpose of this document: inventory every source field, record its real-world
> quirks, map it to the target data model, and surface the decisions that must be
> made *before* the Prisma schema is designed. Nothing here is final — it is the
> evidence base for Phase 1.

---

## 1. What's actually in the Drive

The shared folder (`/Alwalaa … CRM`) contains:

| Item | Type | Role in the system |
| :-- | :-- | :-- |
| `CRM Sample` | Sheet | The **canonical template** every agent sheet is cloned from. Tabs: *My Deals Status*, *My Leads Pipeline*, *List*. |
| Per-agent folders → one sheet each | Sheets | The **source of truth today**. Audited: **Shatha CRM** (senior/diaspora), **Alex CRM** (advisor/resident). Folders also exist for Pasha, Wesam, Yousef, Humood, Safaa, Menessa, Sulaiman, Tariq, Abeer. |
| `Master CRM` | Sheet | A **manual consolidation attempt** — per-agent tabs (Humood, Safaa, Sulaiman, Abeer, Tariq, Menessa, Shatha). Leaner schema than the per-agent sheets. This is what we are replacing. |
| `Alwalaa Real Estate – Investor Qualification (Responses)` | Sheet | **Inbound lead intake** = the `alwalaa_sourced` funnel (a Google Form's responses). Plus a second tab of bulk-imported "Indian Contact" leads with a totally different shape. |
| `Alwalaa Sales KPI Tracker — May 2026` | XLSX | Existing weekly **pace/Thursday tracker** — informs the KPI dashboard. |

**Finding 0 — there is no single schema.** Even though every sheet derives from one
template, the live sheets have already diverged (extra columns, different spellings,
the Master CRM has fewer columns than the agent sheets). Ingestion must be
**per-source configurable**, not one hardcoded parser.

---

## 2. Anatomy of a standard agent sheet

Two data tabs + one reference tab:

- **`My Deals Status`** — closed/in-progress *deals* (money, developer, commission).
- **`My Leads Pipeline`** — the *lead* funnel (contact, qualification, follow-ups).
- **`List`** — dropdown source values (Nationality, Budget Range, Country of Residence).

Both data tabs carry **decorative pre-header rows** above the real header (e.g.
`"Double click the box so the calender Open"`, `"to be validated by sulaiman"`,
`"7 days remaining"`, group labels `Know your client / Shortlisiting / Client Readiness`).
The parser must **locate the real header row**, not assume row 1.

---

## 3. Field audit — `My Deals Status` tab

Exact header strings shown (note the trailing spaces and misspellings — the adapter must match these literally or via a normalized alias map).

| # | Source header (verbatim) | Real-world quirks seen | Maps to |
| :-- | :-- | :-- | :-- |
| 1 | `S/N` | Row index 1–20; blank rows interleaved; not stable across edits | (ignore — not an ID) |
| 2 | `Client Name ` | Joint buyers in one cell: "Christina and Andreas", "Mohammed Asaduzzaman & Rummana A Ali-Zaman" | `Lead.name` / `Deal` buyer |
| 3 | `Client Contact Number ` | Free-form: `61 470 210 734`, `447896531201`, `+1 (267) 824‑0809` with **embedded Unicode direction marks + non-breaking hyphen**; `2 (949) 827-5847` (manually prefixed to disambiguate duplicates) | `Lead.contact` (normalize to E.164) |
| 4 | `Client Email Adress ` | Misspelled header; `\-` = "none"; trailing TAB char (`entezar@comp2i.com\t`); two emails in one cell | `Lead.email` |
| 5 | `Develoepr Name` | Misspelled header. **Massive variant problem** — see §6 | `Deal.developerId` (FK after canonicalize) |
| 6 | `Project name` | Variants: `Wadi Zaha`/`WADI ZAHA`, `Sarooj Oasis`/`Sarooj osis`, `Olive farms - Raya Jebel Sifah` | `Deal.projectId` |
| 7 | `unit type` | `Studio`, `1BHK`, `2 BHK`, `2BD`, `Penthouse 3BHK`, `Town House`, `Retail in 96`, `Stand alone villa` — free text | `Deal.unitType` (enum + raw) |
| 8 | `unit number` | `E26-D512`, `B1-409`, `ID:96.GF.RT.01`, `B2-` (incomplete) | `Deal.unitNumber` |
| 9 | `Alwalaa Comission %` | The **developer→Alwalaa** rate. Flat per developer: Ahly Sabbour `3.5`, Sarooj `4`, Muriya `3`, Al Abrar `3`, Adante `3` | `Commission.developerRate` |
| 10 | `Property Value ( excld vat ) Based on SPA` | **Money-as-text**: `"43,500.00  OMR "` (comma thousands, 2 dp, double-spaced " OMR ", trailing space). The deal value. | `Deal.dealValue` (Decimal) |
| 11 | `Deal Stage ` | `CLOSED`, `Pending` — see stage inventory §5 | `Deal.canonicalStage` |
| 12 | `Deal Closed On (date)` | **Mixed**: `10/30/2025` (M/D/Y) **and** `28/01/2026` (D/M/Y); plus **non-dates** `On Progress`, `SPA pending` | `Deal.closeDate` + drives month (see Decision 3) |
| 13 | `alwalaa invoice submition to developer via email` | `YES` / `NO` / blank | `Commission` workflow flag |
| 14 | `Expected Comission Recived due date` | Date; sometimes `#VALUE!` (broken formula); `6/16/2026` | `Commission.expectedDate` |
| 15 | `alwalaa net ( exld vat ) commission from developer` | Money; **Shatha** writes `1,522.50  OMR `, **Alex** writes `1,875.06` (no suffix) | `Commission.alwalaaGross` (recompute, don't trust) |
| 16 | `Alwalaa Comission payment Status` | `Recieved `/`Not Recived`/`Not paid`/blank (misspelled, inconsistent) | `Commission.developerPaidStatus` |
| 17 | `My comission Payment status` | `Paid`/`Not paid`/blank | `Commission.agentPaidStatus` |
| 18 | `My Comission %` | **The agent split.** Shatha `35` (Alwalaa/blank source) & `50` (Own/Referral); Alex `25` (all Alwalaa). **Currently driven by lead source, not % of target** — see Decision 1 | `Commission.agentSplitRate` (engine-computed, not entered) |
| 19 | `My Comission Amount ` | Money; 2–3 dp (`468.765`) | `Commission.agentPayout` (recompute) |
| 20 | `Lead Source ` | `Alwalaa Leads`, `Referral Leads`, `My Own Lead`, blank; stray junk (`448`, `5187` = phone fragments) | `Lead.source` + `Commission.attributionReason` |
| 21 | `Notes/Remarks (If any)` | Free text incl. **co-broker notes**: *"Yousef has no share in this deal"* | `Deal.notes` + split flag |

Bottom-of-tab aggregates (`My Total Sales Volume`, `My Total Comission Earned`,
`Paid`, `Balance`, inline `March Target | 260,000.00 OMR`) are **derived** — recompute,
never ingest.

---

## 4. Field audit — `My Leads Pipeline` tab

| Source header (verbatim) | Quirks | Maps to |
| :-- | :-- | :-- |
| `Title ` | Mr./Mrs./Dr./Ms. (free) | `Lead.title` |
| `Lead Name ` | Often prefixed again ("Mr. Sakaria") | `Lead.name` |
| `Lead Contact Number ` | As §3 | `Lead.contact` |
| `Email ` | Mostly blank in pipeline | `Lead.email` |
| `Country of Residence` | Free text, mostly clean | `Lead.countryOfResidence` |
| `Preferered Language ` | English/Arabic/Urdu/Hindi/Other (misspelled header) | `Lead.language` |
| `Preferred Currency ` | OMR/USD/GBP/AED/EUR | `Lead.currency` |
| `Occupation Type` | `Employee- Private sector`, `Buissness Owner`, `Self Employed`, `Other` | `Lead.occupationType` |
| `Speisify…`/`Speicify…` (**spelling differs Shatha vs Alex**) | Free text | `Lead.occupationDetail` |
| `Family Size ` | `Single`, `Couple`, `couple + 2 children`, `Large Family` | `Lead.familySize` |
| `Recieved / Registred On ( Date ) ` | Date; **typo year `3/19/2926`** | `Lead.registeredAt` |
| `Lead Source ` | `Alwalaa Leads` dominant | `Lead.source` |
| `Lead Stage ` | `Contacted`, `Qualification meeting`, blank — see §5 | `Lead.canonicalStage` |
| `Nationality ` | From `List`; sometimes blank | `Lead.nationality` |
| `Budget Range ` | Banded text `50,000 – 75,000 OMR` (en-dash) | `Lead.budgetBand` |
| `Purpose of Purchasing` | `Investment - Rental Income`, `Primary Residance ( End User )`, `Secondary Home` | `Lead.purpose` |
| `Unit prefered ` | Free text | `Lead.unitPreference` |
| `Project Area Prefered ` | `Sultan Haitham City`, `Jabal Sifah`, `Salalah`, `Almouj`… | `Lead.areaPreference` |
| `Property Status ` | `Off-Plan`, `Under-Construction`, `Ready To Move` | `Lead.propertyStatus` |
| `Developer Name ` / `Project Name ` | Same variant problem as deals | `Lead.projectInterest` |
| `Ready To reserve Now ( Token Amount )` | `YES`/`NO` | **Reservation signal** (Decision 3) |
| `Readines of purchasing (timeline)` | `less than 7 days`, `7days to 14days`, `more than 30 days`, `Not spesified` | `Lead.timeline` |
| `Ready For down Pyament ( 10% / 20%)` | `YES`/`NO` | `Lead.downPaymentReady` |
| `Deal Status ` | `LOST`, `CLOSED`, `In Progress`, `In Progress ` (trailing space) — **a third stage column** | conflated stage — see §5 |
| `My Notes , Comments Actions ` | Rich free text, multi-attempt logs, `LOST`/`SOLD`/`TAKEN OVER BY YOUSEF` markers | `Lead.notes` (mine for events) |
| `Last Follow Up date ` | Mixed M/D/Y & D/M/Y | `Lead.lastFollowUpAt` |

---

## 5. Stage-label inventory → canonical pipeline

The core problem the brief calls out is real and **worse than one catch-all** — stage
lives in **three different columns** that disagree:

- Deals tab `Deal Stage `: `CLOSED`, `Pending`
- Pipeline `Lead Stage `: `Contacted`, `Qualification meeting`, *(blank)*
- Pipeline `Deal Status `: `LOST`, `CLOSED`, `In Progress`, `In Progress ` *(trailing space)*
- Plus signals embedded elsewhere: `Ready To reserve Now = YES`, `Deal Closed On = "SPA pending"/"On Progress"`, notes saying `SOLD`/`LOST`.

Proposed `StageMapping` seed (canonical: **New → Qualified → Engaged → Viewing → Negotiation → Reservation → Closed-Won → Closed-Lost**):

| Source signal | Proposed canonical | Confidence |
| :-- | :-- | :-- |
| New Investor-Qualification form response | **New** | high |
| `Lead Stage = Contacted` | **Qualified** (reached, not yet meeting) | med — could be New |
| `Lead Stage = Qualification meeting` | **Engaged** | high |
| (no explicit source value) | **Viewing** | ⚠ not tracked today |
| `Deal Status = In Progress` | **Negotiation** | med |
| `Ready To reserve Now = YES` / token paid | **Reservation** | ⚠ needs Decision 3 |
| `Deal Stage/Deal Status = CLOSED`; note `SOLD` | **Closed-Won** | high |
| `Deal Status = LOST`; note `LOST`/`No response` | **Closed-Lost** | high |
| `Deal Stage = Pending` / `Deal Closed On = "SPA pending"` | **Reservation** (booked, awaiting SPA) | med |

**Finding 5 — the source can't cleanly populate all 8 stages.** `Viewing` and
`Negotiation` are largely invisible in the current sheets. We will infer what we can,
default the rest, and (Phase 4) give agents a proper stage dropdown so future data is
clean. Mapping is stored in `StageMapping` (editable, per-agent if needed) so we never
hardcode any agent's vocabulary.

---

## 6. Canonicalization dictionaries (seed data)

**Developers** — raw → canonical:

| Raw values seen | Canonical |
| :-- | :-- |
| `Alahly Sabbour`, `Ahly sabbour`, `Ahli Sabbur`, `AHLY SUBBOUR`, `Ahly Sabbour` | **Ahly Sabbour** |
| `Sarooj development `, `Sarooj`, `SAROOJ OASIS` | **Sarooj Development** |
| `Muriya`, `Muriya development ` | **Muriya** |
| `alabrar`, `AlAbrar`, `Alabrar Real estate`, `AlAbrar Real Estate` | **Al Abrar** |
| `Adante`, `ADANTE`, `Adante Realty` | **Adante Realty** |

**Projects**: `Wadi Zaha` (Ahly Sabbour — PRIMARY), `Hay Al Wafaa` (Al Abrar),
`Yenaire` (Adante), `Sarooj Oasis` (Sarooj), `Olive Farms / Raya Jebel Sifah` (Muriya).

**Lead source**: `Alwalaa Leads` → `alwalaa_sourced`; `My Own Lead`/`Referral Leads` → `agent_network`.

**Money parser** must strip `,` and ` OMR `, handle 2–3 dp, reject `#VALUE!`/text → log as bad row.
**Date parser** must resolve ambiguous M/D vs D/M (use known-good anchors + reject impossible like year 2926), and route non-date text (`SPA pending`) to a status field, not the date.

---

## 7. Consolidated data-quality risks (for the Zod reject-and-log layer)

1. **Money is text** with currency suffix, thousands commas, variable precision, stray spaces.
2. **Dates are ambiguous & dirty** — mixed locales, typo years, text-in-date-cell, `#VALUE!`.
3. **Duplicates** — same buyer, multiple units = multiple legitimate deals (Entezar ×2, Nahida Karim ×2); dedup must key on buyer **+ unit**, not name alone.
4. **Co-brokered deals** — notes like *"Yousef has no share in this deal"* prove agent-to-agent splits exist (Decision 2).
5. **Header drift** — trailing spaces, misspellings (`Develoepr`, `Comission`, `Speisify`/`Speicify`), per-agent variation.
6. **Stage conflated across 3 columns** (§5).
7. **Derived totals & targets embedded in the grid** — must be excluded from ingest.
8. **PII**: real client names, phones, emails. Staging is append-only; access is RLS-gated (Phase 6).

---

## 8. How sources map to the target entities

- **Lead** ← Pipeline tab + Investor-Qualification form (source attribution: form/import = `alwalaa_sourced`).
- **Deal** ← Deals tab (value, unit, dates, stage).
- **Developer / Project** ← canonicalization dictionaries (§6) + brief's developer list.
- **Commission** ← Deals tab columns 9,15,18,19 — but **recomputed** by the engine, with the sheet values kept only for reconciliation. `attributionReason` ← Lead Source.
- **Agent / Target** ← brief's roster + role-based targets; note sheets show inline targets (e.g. `260,000`) that differ from the brief's role defaults (Decision 4).
- **MonthlyPerformanceSnapshot / Reward / AtRisk** ← computed, no source columns.

---

## 9. Decisions — RESOLVED (2026-06-03, CEO)

| # | Decision | Outcome | Schema / engine implication |
| :-- | :-- | :-- | :-- |
| 1 | Commission split basis | **Hybrid: performance ladder + lead-source floor** | Engine computes the 25/35/40/50 ladder rate from % of monthly target, then applies a **source floor**: own/referral leads never fall below their floor (**default 50% — to confirm**); Alwalaa-sourced leads are ladder-only. `agentSplitRate = max(ladderRate, sourceFloor(leadSource))`. Needs a `LeadSourceFloor` config table so floors stay config, not code. |
| 2 | Co-brokered deals | **Support multi-agent splits** | `Deal` ↔ `Agent` is **many-to-many** via a `DealAttribution` join (agent, sharePct, role). Sales volume toward target **and** payout divide by share. Commission rows are per-attribution. |
| 3 | Month-attribution date | **`Deal Closed On` drives the month** | The month a deal counts in = `Deal.closeDate` (not `reservationDate`). `reservationDate` is still stored (optional, for funnel analytics) but does **not** drive commission month. Overrides the brief on this point, per CEO. |
| 4 | Developer rate model | **Tier-ready schema, seeded flat** | `DeveloperCommissionRule` supports quarterly-volume tiers (threshold → rate), but is **seeded with today's flat rates**: Ahly Sabbour 3.5%, Sarooj 4%, Muriya 3%, Al Abrar 3%, Adante 3%. |

**One open parameter:** the source-floor value for own/referral leads (Decision 1).
Default assumed = **50%** (matches what the sheets show). To be confirmed at the Phase 1 review.

---

## 10. Next step

On approval of this audit + the four decisions above, proceed to **Phase 1**: Prisma
schema + migrations, seeded with developers, projects, the agent roster, role-based
targets, the StageMapping dictionary (§5), the canonicalization dictionaries (§6), and the
25/35/40/50 CommissionLadder. **No schema will be written until then.**
