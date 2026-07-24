# Google Sheets → Supabase sync (SCAFFOLD)

Mirrors the existing **Zoho** path (`supabase/functions/zoho-ingest`): an n8n
workflow reads the live Google Sheets on a schedule and POSTs each entity to a
token-gated Supabase **edge function** that upserts with the service role.

```
Schedule (n8n)
  → Google Sheets "read" node (one per source sheet)
    → Function node  { entity, rows }        ← rows keyed by the sheet's headers
      → HTTP POST  →  sheets-ingest edge fn  ← normalizes + maps + UPSERTs
                        → Supabase (service role, RLS-bypass, idempotent)
```

**New files**
- `supabase/functions/sheets-ingest/index.ts` — the edge function (all mapping +
  normalization lives here, so it is the single testable source of truth).
- `n8n/alwalaa-sheets-sync.workflow.json` — importable workflow skeleton, FK-safe
  order pre-wired.
- `docs/SYNC-SETUP.md` — this file.

**Idempotency.** Every upsert is on `(organization_id, external_id)` — re-runs are
safe. `organization_id` is the single seeded org
`6a32be59-155d-4662-9058-3a74fb2b6872`.

**Auth.** Same style as zoho-ingest: a shared `x-sync-token` header carrying the
`SHEETS_INGEST_TOKEN` secret. Writes use `SUPABASE_SERVICE_ROLE_KEY`.

**FK-safe order** (the workflow enforces it by chaining the POSTs):
`staff → units → leads → deals → invoices → collections`.
`leave_types` are already seeded by migration `0005_integration_seed`; seed them
first only if you rebuild the DB from an earlier point.

> This is a **scaffold**. Missing source fields are left `null` with a clearly
> marked `// TODO` — nothing is invented. Two entities (**staff**, **units**)
> cannot upsert until the schema gaps in §D are fixed.

---

## A. The mapping (from profiling the live sheets)

`external_id` is the upsert key per entity. `g(...)` in the edge function tries
several header-name variants; the primary header is shown below.

### staff → `staff_profiles`
Source: **HR Master Tracker** `1om5DiSVPFbW0twHLPwY7FbBmLJ4_c9gG`, tab **Employee Register**

| Target column | Source | Normalizer / note |
| :-- | :-- | :-- |
| `external_id` | Emp Code (`ALW-001`) | — (⚠️ column missing — §D) |
| `full_name` | Full Name | ⚠️ lives on `profiles`, not `staff_profiles` — §D |
| `role` | Role/Position | ⚠️ `staff_role` enum — needs a text→enum map |
| `status` | Status (Active/LEFT) | `Active→active`, `LEFT→former` |
| `segment` | Department | ⚠️ `agent_segment` enum (diaspora/resident/na) — Department ≠ segment |
| `monthly_target_omr` | — | **TODO**: not in HR. Source from Sales dashboard `1eKUyEn-fBer7WeYeUwo7ZqWDByP2M_Hp`, tab **Dashboard** |

### units → `units`
Source: **MASTER LISTING TRACKER** `1MVhHL-5SFxEhP-IiGUKlC2G3IIgoVfR3PsQ8TEvrJHk`, single main tab

| Target column | Source | Normalizer / note |
| :-- | :-- | :-- |
| `external_id` | **Ref Fix** (not Ref No — duplicated) | — (⚠️ column missing — §D) |
| `reference_id` | Ref Fix | NOT NULL broker SKU |
| `project_id` | Project | ⚠️ NOT NULL FK — resolve/upsert a `projects` row first (**TODO**) |
| `unit_type` | Category | ⚠️ `unit_type` enum — needs a Category→enum map |
| `bedrooms` | Beds | `parseBeds` (`5+1`→5 beds+maid, `Studio`→0) |
| `area_sqm` | Size sqm | numeric |
| `price_omr` | Price OMR | numeric |
| `status` | — | **TODO**: no availability column in the sheet — §D |

### leads → `leads`
Source: **Investor Qualification (Responses)** `1dQCcNSvWWtnkNg0swxnKRv8xTW-yMNCOPJ7oskWUZfY`, **THREE tabs** (form responses; WHIN register with `Lead ID` `L001`; B2B import)

| Target column | Source | Normalizer / note |
| :-- | :-- | :-- |
| `external_id` | Lead ID (WHIN) → else email → else phone | phone last (corrupted — see below) |
| `name` | Name | — |
| `phone_e164` | Phone | `normalizePhoneE164` (handles `9.66E+12`) |
| `nationality` | Nationality | — |
| `country` / `country_code` | (derive) | **TODO**: derive from nationality or phone CC — not invented |
| `budget_min_omr` / `budget_max_omr` | Budget | `parseBudgetRange("150,000 - 300,000 OMR")` |
| `stage` | Stage/Status | `toLeadStage` → `lead_stage` enum (unknown→`new`) |
| `source` | Source | — |
| `last_touch_at` | Last Touch / Timestamp | — |
| `interest_project_id` | interest (project/location) | ⚠️ FK — resolve a `projects` row (**TODO**) |

### deals → `deals`
Source: **Master CRM - Management Control** `1B4XP-Udfuiuw1FZdgpgPZqUhNPmT4qH8MiG5hvhcPZ0`, tab **Master Deals** (not the raw JSON tab)

| Target column | Source | Normalizer / note |
| :-- | :-- | :-- |
| `external_id` | Deal ID (`WES-0001`) | — |
| `agent_id` | (agent identity) | ⚠️ NOT NULL FK — resolve via alias table (§E) (**TODO**) |
| `client_name` | Client Name | — |
| `value_omr` | Property Value (excl VAT) | NOT NULL |
| `payout_omr` | Alwalaa Net Commission | numeric |
| `closed_at` | Deal Closed On | — |
| `developer_paid` | Alwalaa Payment Status | `statusToBool` |
| `agent_paid` | Agent Payment Status | `statusToBool` |
| _(dropped)_ | developer / project / stage / lead source | no columns on `deals` — resolve or add columns; not invented |

### invoices → `invoices`
Source: **Invoice and Client tracker.xlsm** `1QlAgP_nFj6Ck2QmgLCf6QwEouw8NNHrG`, tab **INV Detail**

| Target column | Source | Normalizer / note |
| :-- | :-- | :-- |
| `external_id` / `reference` | Invoice No (`AWLP-2025-00030`) | `canonicalInvoiceNo` (pads the tail) |
| `developer` | Bill To | — |
| `amount_omr` | Net Amount | use **Net** consistently |
| `status` | Payment Status | `statusToInvoiceStatus` → `invoice_status` enum |
| `issued_date` | Inv Date | — |
| `due_date` | Expected Date | — |

### collections → `collections`
Source: **same INV Detail** (the payment rows)

| Target column | Source | Normalizer / note |
| :-- | :-- | :-- |
| `external_id` | Invoice No **+ Payment Date** | keeps partial payments distinct |
| `invoice_id` | (Invoice No) | ⚠️ FK — resolve to `invoices.external_id` after invoices sync (**TODO**) |
| `amount_omr` | Payments Made / credit | numeric |
| `received_date` | Payment Date | — |
| `method` | Mode | — |
| _(derived)_ | Balance | no column — derive as `invoice.amount − Σ collections` |

---

## B. Normalizers (in `sheets-ingest/index.ts`)

- **`normalizePhoneE164(raw)`** — best-effort E.164. Expands sci-notation
  (`9.66E+12`), strips separators, keeps a leading `+`, returns `null` if
  unusable. **TODO in code:** source phones are corrupted (Excel dropped digits);
  `phone_e164` must never be the sole key — pair with Lead ID / email.
- **`parseBudgetRange("150,000 - 300,000 OMR")`** → `{ min, max }`.
- **`parseBeds("5+1" | "Studio")`** → `{ bedrooms, hasMaid }` (the `+1` is a
  maid's room, not a bedroom).
- **`normStatus(raw)`** → canonical token, tolerant of the real misspellings
  (`Recieved` / `Not Recived`). Wrappers: `statusToBool` (Paid/Received → true),
  `statusToInvoiceStatus` (→ `invoice_status` enum).
- **`canonicalInvoiceNo(raw)`** → pads the numeric tail (`AWLP-2025-30` →
  `AWLP-2025-00030`).

---

## C. GO-LIVE CHECKLIST

**(a) Google Cloud service account**
1. Google Cloud Console → new/existing project → enable the **Google Sheets API**
   (and **Drive API**).
2. Create a **Service Account** → create a **JSON key**.
3. Share the shared Drive **`0APe4xxhBnmGGUk9PVA`** **read-only (Viewer)** with the
   service account's `...@...iam.gserviceaccount.com` email. (Sharing the Drive
   covers every sheet inside it; no need to share each file.)

**(b) Secrets**
- `SUPABASE_SERVICE_ROLE_KEY` — already used by zoho-ingest; the edge function
  reuses it. Set it on the `sheets-ingest` function too.
  (`supabase secrets set SUPABASE_SERVICE_ROLE_KEY=…`)
- `SHEETS_INGEST_TOKEN` — a new long random string. Set it as a Supabase secret
  **and** as the `x-sync-token` value n8n sends (`$env.SHEETS_INGEST_TOKEN`).
- Google service-account JSON → paste into **n8n → Credentials → Google API
  (Service Account)**; point every "Read" node's credential at it.
- Deploy: `supabase functions deploy sheets-ingest`.

**(c) Import & schedule the workflow**
1. n8n → **Workflows → Import from File** → `n8n/alwalaa-sheets-sync.workflow.json`.
2. Fill placeholders: each Read node's **tab** (`REPLACE_WITH_TAB_GID` — re-pick
   the tab from the dropdown) and the **credential**
   (`REPLACE_GOOGLE_SA_CREDENTIAL_ID`). File IDs are pre-filled from the mapping.
3. Set n8n env vars: `SHEETS_INGEST_URL` (the deployed function URL,
   `https://<project-ref>.functions.supabase.co/sheets-ingest`) and
   `SHEETS_INGEST_TOKEN`.
4. Set the **Schedule Trigger** (skeleton ships **every 15 min**; nightly is fine
   for finance/HR). Toggle **Active**.
5. The **leads** source has 3 tabs — add one Read node per tab (or run the swap
   3×) and merge before the leads POST.

**(d) TWO SCHEMA GAPS TO FIX FIRST** ⚠️
1. **Units availability.** Reconciled with the actual migrations: `units.status`
   **already exists** (`unit_status` enum `available/reserved/sold`) from
   `0002_sales_core`, but it **lacks `hold`**; and `units.feed`
   (`published/private`) already models publishing state. So:
   - `alter type unit_status add value 'hold';` (→ `available|hold|reserved|sold`).
   - Map the sheet's **Website / Dubizzle** columns to `units.feed` (publishing
     state) — they are **not** availability.
2. **No deal ↔ invoice link.** At the DB level `invoice_items.deal_id` exists, but
   the **source sheets share no key** to populate it. Add **Invoice No** to
   *CRM Master Deals* **or** **Deal ID** to *Finance INV Detail* so the sync can
   wire the link.

**Additional gaps found while scaffolding (must fix for staff/units to upsert):**
3. **`staff_profiles` has no `external_id`** and no `(organization_id, external_id)`
   unique index (0005 added those to invoices/collections/leads/deals only). Also
   `full_name` lives on `profiles`, and `staff_profiles.id → profiles.id →
   auth.users.id` — so a staff row needs an **identity** first; you can't upsert
   by Emp Code alone. Add `external_id` (+ index) mirroring 0005 **and** decide how
   identity is provisioned, or land HR into a staging table.
4. **`units` has no `external_id`** (unique key is `(project_id, reference_id)`,
   both NOT NULL). Add `external_id` (+ index) mirroring 0005, or change the
   function to upsert on `(project_id, reference_id)` after resolving `project_id`.
5. `role` / `segment` / `stage` / status columns are **Postgres enums** — free
   text won't cast; build the small mapping tables noted in §A or unmapped rows
   reject.

**(e) Agent-alias → Emp Code table.** Agent identity differs per sheet, and
`deals.agent_id` is a NOT NULL FK, so a lookup is required before deals can land:

| Sheet | How the agent appears | Example |
| :-- | :-- | :-- |
| CRM | first name / Deal-ID prefix | `WES…` → Wesam |
| Finance | full formal name | `Mrs. Shatha Al Manthari` |
| HR | Emp Code | `ALW-006` |

Build a table keyed by **Emp Code** with alias columns (`crm_first_name`,
`deal_id_prefix`, `finance_full_name`) → resolves to the `profiles.id` used as
`deals.agent_id` (and eventually `staff_profiles`/`leads.assigned_agent_id`).

---

## D. Verify

- `sheets-ingest` is a Deno edge function — it is **excluded** from the Next
  `tsconfig.json` (`exclude: ["supabase/functions"]`) and from vitest
  (`include: src/**/*.test.ts`), exactly like `zoho-ingest`, so it does not affect
  `npm run typecheck` / `npm test` / the Next build.
- Smoke test after deploy:
  ```bash
  curl -X POST "$SHEETS_INGEST_URL" \
    -H "x-sync-token: $SHEETS_INGEST_TOKEN" \
    -H "content-type: application/json" \
    -d '{"entity":"invoices","rows":[{"Invoice No":"AWLP-2025-30","Bill To":"Aida","Net Amount":"1200.500","Payment Status":"Not paid","Inv Date":"2025-06-01","Expected Date":"2025-07-01"}]}'
  # → { "ok": true, "entity": "invoices", "table": "invoices", "upserted": 1 }
  ```
