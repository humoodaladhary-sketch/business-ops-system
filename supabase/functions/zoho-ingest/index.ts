// Zoho Books → Supabase ingest (called by the n8n sync workflow).
// Auth: shared x-sync-token header. Writes with the service role (bypasses
// RLS by design — this is the trusted machine writer).
//
// POST body: { kind: "invoices" | "payments", rows: ZohoRow[] }
// Upserts are idempotent on (organization_id, external_id) — Zoho's immutable
// IDs — so the sync can re-run safely forever.

import { createClient } from "npm:@supabase/supabase-js@2";

const ORG_ID = "6a32be59-155d-4662-9058-3a74fb2b6872";
// SECRET — set via `supabase secrets set ZOHO_SYNC_TOKEN=...` and mirror it in
// the n8n workflow's x-sync-token header. Fails closed when unset.
const SYNC_TOKEN = Deno.env.get("ZOHO_SYNC_TOKEN") ?? "";

const STATUS_MAP: Record<string, string> = {
  draft: "draft", sent: "sent", viewed: "sent", overdue: "overdue",
  paid: "paid", partially_paid: "partially_paid", void: "cancelled",
  unpaid: "sent",
};

type Json = Record<string, unknown>;
const s = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const n = (v: unknown): number => (v == null ? 0 : Number(v) || 0);
const period = (date: string | null): string | null => (date ? date.slice(0, 7) : null);

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
  if (!SYNC_TOKEN) {
    return Response.json({ error: "not_configured", detail: "ZOHO_SYNC_TOKEN secret is not set" }, { status: 503 });
  }
  if (req.headers.get("x-sync-token") !== SYNC_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { kind?: string; rows?: Json[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return Response.json({ ok: true, upserted: 0 });

  if (body.kind === "invoices") {
    const mapped = rows.map((r) => ({
      organization_id: ORG_ID,
      external_id: s(r.invoice_id),
      reference: s(r.invoice_number),
      developer: s(r.customer_name),
      amount_omr: n(r.total),
      period: period(s(r.date)),
      issued_date: s(r.date),
      due_date: s(r.due_date),
      status: STATUS_MAP[String(r.status ?? "").toLowerCase()] ?? "sent",
      notes: s(r.reference_number),
    }));
    const { error, count } = await supa
      .from("invoices")
      .upsert(mapped, { onConflict: "organization_id,external_id", count: "exact" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, kind: "invoices", upserted: count ?? mapped.length });
  }

  if (body.kind === "payments") {
    const mapped = rows.map((r) => ({
      organization_id: ORG_ID,
      external_id: s(r.payment_id),
      reference: s(r.payment_number ?? r.reference_number),
      amount_omr: n(r.amount),
      received_date: s(r.date),
      method: s(r.payment_mode),
    }));
    const { error, count } = await supa
      .from("collections")
      .upsert(mapped, { onConflict: "organization_id,external_id", count: "exact" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, kind: "payments", upserted: count ?? mapped.length });
  }

  return Response.json({ error: `unknown kind: ${body.kind}` }, { status: 400 });
});
