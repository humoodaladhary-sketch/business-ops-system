// Google Sheets → Supabase ingest (called by the n8n alwalaa-sheets-sync workflow).
// Modeled 1:1 on supabase/functions/zoho-ingest/index.ts:
//   - Auth: shared x-sync-token header (the SHEETS_INGEST_TOKEN secret).
//   - Writes with the service role (bypasses RLS by design — trusted machine writer).
//   - Idempotent UPSERT on (organization_id, external_id) so the sync re-runs safely.
//
// POST body: { entity, rows }
//   entity ∈ "staff" | "units" | "leads" | "deals" | "invoices" | "collections"
//   rows   = the raw Google-Sheets rows (keyed by the sheet's own header names).
//            n8n forwards them as-is; the authoritative source→table mapping and
//            all normalization live HERE so the mapping is testable in one place.
//
// FK-safe call order (the n8n workflow enforces it): staff → units → leads →
// deals → invoices → collections.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ SCHEMA GAPS — this is a SCAFFOLD. Two entities cannot actually upsert yet:
//   • staff_profiles has NO external_id column and NO (organization_id,external_id)
//     unique index, and its full_name lives on `profiles` (identity is split, and
//     staff_profiles.id → profiles.id → auth.users.id). See docs/SYNC-SETUP.md §D.
//   • units has NO external_id column; its unique key is (project_id, reference_id)
//     and project_id/reference_id are NOT NULL. See docs/SYNC-SETUP.md §D.
// migration 0005 added external_id+index to invoices/collections/leads/deals only.
// The staff/units handlers below are written to the requested shape but require
// that migration to be extended first (mirroring 0005). Honest TODOs over guesses.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "npm:@supabase/supabase-js@2";

// The single Alwalaa org (seeded in migration 0005_integration_seed).
const ORG_ID = "6a32be59-155d-4662-9058-3a74fb2b6872";

// Same secret style as zoho-ingest's x-sync-token, read from the SHEETS_INGEST_TOKEN
// secret. Empty when unset — the request handler rejects with 503 (a literal
// placeholder fallback would itself be a guessable token).
const SHEETS_INGEST_TOKEN = Deno.env.get("SHEETS_INGEST_TOKEN") ?? "";

// ─── tiny value coercers (same helpers as zoho-ingest) ───────────────────────
type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (v == null || v === "" ? null : String(v).trim() || null);
const num = (v: unknown): number => (v == null ? 0 : Number(String(v).replace(/[^\d.-]/g, "")) || 0);
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** First non-empty value across header-name variants (sheets rename columns). */
function g(r: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// NORMALIZERS — small, best-effort, honest. Corrupted/missing input → null.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * normalizePhoneE164 — best-effort E.164 from the mangled phone strings the
 * sheets hold. Handles Excel/Sheets sci-notation ("9.66E+12"), strips spaces &
 * separators, keeps a leading "+", and returns null when it can't produce a
 * plausible number.
 *
 * TODO: the source phones are CORRUPTED (Excel dropped leading 0/+ and coerced
 *       long numbers to sci-notation, losing digits). phone_e164 MUST NOT be the
 *       sole upsert/dedup key — always pair it with Lead ID or email.
 */
function normalizePhoneE164(raw: unknown): string | null {
  if (raw == null) return null;
  let str = String(raw).trim();
  if (!str) return null;

  // "9.66E+12" → "9660000000000" (precision already lost upstream — flagged above).
  if (/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) {
    const n = Number(str);
    if (!Number.isFinite(n)) return null;
    str = n.toFixed(0);
  }

  const hadPlus = str.startsWith("+");
  const digits = str.replace(/\D/g, "");
  // E.164 is 8–15 digits incl. country code; anything shorter is unusable.
  if (digits.length < 8 || digits.length > 15) return null;

  if (hadPlus) return "+" + digits;
  if (digits.startsWith("00")) return "+" + digits.slice(2); // 00-prefixed intl.
  if (digits.startsWith("968")) return "+" + digits; // already Oman CC
  if (digits.length === 8) return "+968" + digits; // bare Oman national number
  return "+" + digits; // best-effort: assume the CC is present
}

/**
 * parseBudgetRange — "150,000 - 300,000 OMR" → { min: 150000, max: 300000 }.
 * A single value returns min == max. No numbers → both null.
 * TODO: does not expand "k"/"m" suffixes or open-ended "500,000+" — extend if the
 *       form starts emitting those.
 */
function parseBudgetRange(raw: unknown): { min: number | null; max: number | null } {
  if (raw == null) return { min: null, max: null };
  const nums = String(raw).replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return { min: null, max: null };
  const vals = nums.map(Number).sort((a, b) => a - b);
  return { min: vals[0], max: vals[vals.length - 1] };
}

/**
 * parseBeds — Gulf bed notation → structured. "Studio" → 0 beds; "5+1" → 5 beds
 * with a maid's room (the "+1" is a maid's room, not a bedroom).
 */
function parseBeds(raw: unknown): { bedrooms: number | null; hasMaid: boolean } {
  if (raw == null) return { bedrooms: null, hasMaid: false };
  const str = String(raw).trim().toLowerCase();
  if (!str) return { bedrooms: null, hasMaid: false };
  if (str.startsWith("studio")) return { bedrooms: 0, hasMaid: false };
  const m = str.match(/(\d+)\s*(?:\+\s*(\d+))?/);
  if (!m) return { bedrooms: null, hasMaid: false };
  return { bedrooms: Number(m[1]), hasMaid: m[2] != null && Number(m[2]) > 0 };
}

// Canonical status vocabulary the sheets' free text collapses into.
type CanonStatus = "received" | "not_received" | "paid" | "not_paid" | "partial" | "unknown";

/**
 * normStatus — canonicalize the messy status tokens. Tolerates the real
 * misspellings seen in the sheets ("Recieved", "Recived", "Not Recived") and the
 * paid/not-paid pair. Callers map the canonical value onto their column's type.
 */
function normStatus(raw: unknown): CanonStatus {
  const t = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return "unknown";
  const neg = /\bnot\b/.test(t) || t.startsWith("un");
  if (/rec[ie]+ved/.test(t)) return neg ? "not_received" : "received"; // received/recieved/recived
  if (/partial/.test(t)) return "partial";
  if (/paid/.test(t)) return neg ? "not_paid" : "paid";
  return "unknown";
}

/** Canonical status → boolean "money moved" (deals.developer_paid / agent_paid). */
function statusToBool(raw: unknown): boolean {
  const c = normStatus(raw);
  return c === "paid" || c === "received";
}

/** Canonical status → invoices.invoice_status enum. */
function statusToInvoiceStatus(raw: unknown): string {
  switch (normStatus(raw)) {
    case "paid": return "paid";
    case "partial": return "partially_paid";
    case "not_paid":
    case "not_received": return "sent"; // issued, awaiting collection
    // TODO: the sheet carries no signal for 'overdue'/'draft'/'cancelled'.
    default: return "draft";
  }
}

// leads.stage is the lead_stage enum. The lead sheets use free-text labels that
// do NOT map 1:1 — extend this dictionary as real labels are observed.
const LEAD_STAGE_MAP: Record<string, string> = {
  "new": "new", "fresh": "new", "uncontacted": "new",
  "qualified": "qualified", "hot": "qualified",
  "engaged": "engaged", "contacted": "engaged", "in progress": "engaged",
  "viewing": "viewing", "visit": "viewing",
  "negotiation": "negotiation", "offer": "negotiation",
  "reservation": "reservation", "reserved": "reservation",
  "closed won": "closed_won", "won": "closed_won", "closed": "closed_won",
  "closed lost": "closed_lost", "lost": "closed_lost", "dead": "closed_lost",
};
function toLeadStage(raw: unknown): string {
  const key = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  // TODO: unmapped labels fall back to 'new' — review LEAD_STAGE_MAP against the
  //       WHIN register vocabulary before go-live.
  return LEAD_STAGE_MAP[key] ?? "new";
}

/**
 * canonicalInvoiceNo — pad the numeric tail to a fixed width so "AWLP-2025-30"
 * and "AWLP-2025-00030" collapse to one key. Upper-cased, whitespace removed.
 */
function canonicalInvoiceNo(raw: unknown, width = 5): string | null {
  if (raw == null) return null;
  const str = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!str) return null;
  const m = str.match(/^(.*?)(\d+)$/);
  if (!m) return str;
  return m[1] + m[2].padStart(width, "0");
}

// ═════════════════════════════════════════════════════════════════════════════
// ENTITY MAPPERS — source row (sheet headers) → target-table row.
// Each returns rows shaped for its table; genuinely-missing fields are null+TODO.
// ═════════════════════════════════════════════════════════════════════════════

interface EntitySpec {
  table: string;
  onConflict: string;
  toRows: (rows: Row[]) => Row[];
}

// staff_status enum is active/probation/former. HR sheet uses Active/LEFT.
function toStaffStatus(raw: unknown): string {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "left" || t === "former" || t === "resigned" || t === "terminated") return "former";
  if (t === "probation") return "probation";
  return "active";
}

const MAPPERS: Record<string, EntitySpec> = {
  // ── staff ← HR Master Tracker / "Employee Register" ────────────────────────
  // ⚠️ SCHEMA GAP (see header): staff_profiles has no external_id and no
  //    full_name (full_name is on `profiles`). This mapping is the intended
  //    shape; it needs the identity/external_id migration before it can upsert.
  staff: {
    table: "staff_profiles",
    onConflict: "organization_id,external_id",
    toRows: (rows) =>
      rows.map((r) => ({
        organization_id: ORG_ID,
        external_id: s(g(r, "Emp Code", "Employee Code", "EmpCode")), // ALW-001
        // TODO: full_name belongs on `profiles`, not staff_profiles. Sync it there
        //       (or via a joined view) once identity provisioning exists.
        full_name: s(g(r, "Full Name", "Name")),
        // TODO: `role` is the staff_role enum (9 values). Free-text Role/Position
        //       will NOT cast — build a Role/Position → staff_role mapping table.
        role: s(g(r, "Role/Position", "Role", "Position")),
        status: toStaffStatus(g(r, "Status")), // Active/LEFT → active/former
        // TODO: `segment` is the agent_segment enum (diaspora/resident/na).
        //       Department does not map to it — decide the mapping or drop it.
        segment: s(g(r, "Department", "Segment")),
        // TODO: monthly_target_omr is NOT in HR. Source it from the Sales
        //       dashboard (fileId 1eKUyEn-fBer7WeYeUwo7ZqWDByP2M_Hp, "Dashboard").
        monthly_target_omr: null,
      })),
  },

  // ── units ← MASTER LISTING TRACKER (single main tab) ───────────────────────
  // ⚠️ SCHEMA GAP (see header): units has no external_id; unique key is
  //    (project_id, reference_id) and project_id/reference_id are NOT NULL.
  units: {
    table: "units",
    onConflict: "organization_id,external_id",
    toRows: (rows) =>
      rows.map((r) => {
        const beds = parseBeds(g(r, "Beds", "Bedrooms"));
        return {
          organization_id: ORG_ID,
          external_id: s(g(r, "Ref Fix", "RefFix")), // NOT "Ref No" — that's duplicated
          reference_id: s(g(r, "Ref Fix", "RefFix")), // NOT NULL broker SKU slot
          // TODO: project_id is a NOT NULL FK to projects(id). The sheet has a
          //       free-text Project name — look it up / upsert a projects row and
          //       resolve the id before insert. Left null here (will fail NOT NULL).
          project_id: null,
          // TODO: `unit_type` is an enum (studio/apartment/townhouse/villa/…).
          //       Map the free-text Category onto it; raw text will not cast.
          unit_type: s(g(r, "Category", "Type", "Unit Type")),
          bedrooms: beds.bedrooms,
          area_sqm: numOrNull(g(r, "Size sqm", "Size", "Area sqm")),
          price_omr: numOrNull(g(r, "Price OMR", "Price", "Price (OMR)")),
          // TODO: no availability field in the sheet (see docs/SYNC-SETUP.md §D).
          //       units.status exists but lacks 'hold'; leave null until decided.
          status: null,
          // NOTE: beds.hasMaid captured but units has no maid's-room column — drop
          //       or add one. Not invented here.
        };
      }),
  },

  // ── leads ← Investor Qualification (Responses); 3 tabs (form / WHIN / B2B) ──
  leads: {
    table: "leads",
    onConflict: "organization_id,external_id",
    toRows: (rows) =>
      rows.map((r) => {
        const budget = parseBudgetRange(g(r, "Budget", "Budget Range", "Budget (OMR)"));
        const phone = normalizePhoneE164(g(r, "Phone", "Mobile", "WhatsApp", "Phone Number"));
        const email = s(g(r, "Email", "Email Address"));
        return {
          organization_id: ORG_ID,
          // external_id preference: Lead ID (WHIN tab, e.g. L001) → email → phone.
          // Phone last on purpose (corrupted; see normalizePhoneE164 TODO).
          external_id: s(g(r, "Lead ID", "LeadID")) ?? email ?? phone,
          name: s(g(r, "Name", "Full Name", "Investor Name")),
          phone_e164: phone,
          nationality: s(g(r, "Nationality")),
          // TODO: derive `country`/`country_code` from nationality or the phone CC.
          //       Not invented here — needs a nationality→country lookup.
          country: null,
          country_code: null,
          budget_min_omr: budget.min,
          budget_max_omr: budget.max,
          stage: toLeadStage(g(r, "Stage", "Status")),
          source: s(g(r, "Source", "Lead Source")),
          last_touch_at: s(g(r, "Last Touch", "Last Contact", "Timestamp")),
          // TODO: interest is a project/location free-text; interest_project_id is
          //       a FK. Resolve to a projects row before setting. Left null.
          interest_project_id: null,
        };
      }),
  },

  // ── deals ← Master CRM - Management Control / "Master Deals" ────────────────
  deals: {
    table: "deals",
    onConflict: "organization_id,external_id",
    toRows: (rows) =>
      rows.map((r) => ({
        organization_id: ORG_ID,
        external_id: s(g(r, "Deal ID", "DealID")), // WES-0001
        // TODO: agent_id is NOT NULL (FK profiles, on delete restrict). Resolve it
        //       via the agent-alias → Emp Code → profile mapping (docs/SYNC-SETUP.md
        //       §E). Left null → will fail NOT NULL until the alias table exists.
        agent_id: null,
        client_name: s(g(r, "Client Name", "Client")),
        value_omr: num(g(r, "Property Value (excl VAT)", "Property Value", "Value")), // NOT NULL
        payout_omr: numOrNull(g(r, "Alwalaa Net Commission", "Net Commission")),
        closed_at: s(g(r, "Deal Closed On", "Closed On", "Closed Date")),
        developer_paid: statusToBool(g(r, "Alwalaa Payment Status", "Developer Payment Status")),
        agent_paid: statusToBool(g(r, "Agent Payment Status")),
        // NOTE: the sheet also has developer / project / stage / lead source, but
        //       deals has no columns for them (project is a project_id FK). Resolve
        //       or add columns — not stuffed in here to avoid inventing structure.
      })),
  },

  // ── invoices ← Invoice and Client tracker.xlsm / "INV Detail" ──────────────
  invoices: {
    table: "invoices",
    onConflict: "organization_id,external_id",
    toRows: (rows) =>
      rows.map((r) => {
        const inv = canonicalInvoiceNo(g(r, "Invoice No", "Invoice Number", "Inv No"));
        return {
          organization_id: ORG_ID,
          external_id: inv, // AWLP-2025-00030 (canonicalized)
          reference: inv,
          developer: s(g(r, "Bill To", "Developer", "Client")),
          amount_omr: num(g(r, "Net Amount", "Net", "Amount")), // Net, consistently
          status: statusToInvoiceStatus(g(r, "Payment Status", "Status")),
          issued_date: s(g(r, "Inv Date", "Invoice Date")),
          due_date: s(g(r, "Expected Date", "Due Date")),
          // TODO: project_id FK not resolvable from this sheet — left null.
        };
      }),
  },

  // ── collections ← same INV Detail (payment rows) ───────────────────────────
  collections: {
    table: "collections",
    onConflict: "organization_id,external_id",
    toRows: (rows) =>
      rows.map((r) => {
        const invNo = canonicalInvoiceNo(g(r, "Invoice No", "Invoice Number", "Inv No"));
        const payDate = s(g(r, "Payment Date", "Paid Date"));
        return {
          organization_id: ORG_ID,
          // Invoice No + Payment Date keeps partial payments distinct.
          external_id: invNo ? `${invNo}#${payDate ?? "na"}` : null,
          // TODO: invoice_id is a FK. Resolve by matching invoices.external_id ===
          //       canonicalInvoiceNo(Invoice No) after invoices sync. Left null.
          invoice_id: null,
          amount_omr: num(g(r, "Payments Made", "Payment", "Credit", "Amount")),
          received_date: payDate,
          method: s(g(r, "Mode", "Payment Mode", "Method")),
          reference: invNo,
          // NOTE: the sheet's Balance column has no target column on collections —
          //       it is derivable (invoice.amount − Σ collections); not stored here.
        };
      }),
  },
};

// ═════════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
  if (!SHEETS_INGEST_TOKEN) {
    return Response.json({ error: "not_configured", detail: "SHEETS_INGEST_TOKEN secret is not set" }, { status: 503 });
  }
  if (req.headers.get("x-sync-token") !== SHEETS_INGEST_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { entity?: string; rows?: Row[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const entity = String(body.entity ?? "");
  const spec = MAPPERS[entity];
  if (!spec) {
    return Response.json(
      { error: `unknown entity: ${entity}`, allowed: Object.keys(MAPPERS) },
      { status: 400 },
    );
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return Response.json({ ok: true, entity, upserted: 0 });

  const mapped = spec.toRows(rows).filter((m) => m.external_id != null);
  if (mapped.length === 0) {
    return Response.json({ ok: true, entity, upserted: 0, note: "no rows had a usable external_id" });
  }

  const { error, count } = await supa
    .from(spec.table)
    .upsert(mapped, { onConflict: spec.onConflict, count: "exact" });
  if (error) return Response.json({ error: error.message, entity }, { status: 500 });

  return Response.json({ ok: true, entity, table: spec.table, upserted: count ?? mapped.length });
});
