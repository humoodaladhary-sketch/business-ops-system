import type { SupabaseClient } from "@supabase/supabase-js";
import { AGING_BUCKET_LABELS, OPEN_INVOICE_STATUSES, summarizeAging } from "@/domain/finance/aging";
import { ceoTools } from "./ceoTools";

// The single organization (owner-only mode).
export const ORG_ID = "6a32be59-155d-4662-9058-3a74fb2b6872";

export type ToolInput = Record<string, unknown>;

export interface CopilotTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  /**
   * False for tools that read no database — they run even where no Supabase
   * service-role client is configured. Defaults to true.
   */
  needsDb?: boolean;
  run: (db: SupabaseClient, input: ToolInput, deptId: string) => Promise<unknown>;
}

export interface Department {
  id: DeptId;
  /** False when every tool reads no database — the tool-loop runs regardless. */
  requiresDb?: boolean;
  label: string;
  blurb: string;
  icon: string; // lucide-react name
  accent: string; // tailwind text color
  system: string;
  starters: string[];
  tools: CopilotTool[];
}

export type DeptId = "marketing" | "sales" | "finance" | "hr" | "inventory" | "expert" | "ceo";

const num = (v: unknown, d = 25, max = 100) => Math.min(Math.max(Number(v) || d, 1), max);
const groupCount = (rows: { [k: string]: unknown }[], key: string) => {
  const by: Record<string, number> = {};
  for (const r of rows) {
    const k = (r[key] as string) ?? "unknown";
    by[k] = (by[k] ?? 0) + 1;
  }
  return by;
};

// ---- Cross-department tools (every copilot has these) ----------------------
const handoff: CopilotTool = {
  name: "handoff_to_department",
  description:
    "Send a task or request to another department's copilot. Use when the work belongs to another team (e.g. Sales asking Finance to raise an invoice, Marketing sending a qualified lead to Sales).",
  input_schema: {
    type: "object",
    properties: {
      to_department: { type: "string", enum: ["marketing", "sales", "finance", "hr", "inventory"] },
      title: { type: "string", description: "Short task title" },
      detail: { type: "string", description: "What the other department needs to do, with context" },
      priority: { type: "string", enum: ["low", "normal", "high"] },
    },
    required: ["to_department", "title"],
  },
  run: async (db, input, deptId) => {
    const { data, error } = await db
      .from("department_tasks")
      .insert({
        organization_id: ORG_ID,
        from_department: deptId,
        to_department: input.to_department,
        title: input.title,
        detail: (input.detail as string) ?? null,
        priority: (input.priority as string) ?? "normal",
      })
      .select("id,title,to_department,priority,status")
      .single();
    return error ? { error: error.message } : { handed_off: true, task: data };
  },
};

const inbox: CopilotTool = {
  name: "list_my_inbox",
  description: "List open tasks other departments have handed to THIS department.",
  input_schema: { type: "object", properties: {} },
  run: async (db, _input, deptId) => {
    const { data, error } = await db
      .from("department_tasks")
      .select("id,from_department,title,detail,priority,status,created_at")
      .eq("organization_id", ORG_ID)
      .eq("to_department", deptId)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(50);
    return error ? { error: error.message } : { count: data?.length ?? 0, tasks: data };
  },
};

// ---- Department-specific tools ---------------------------------------------
// A few read tools are shared between their own department and Expert Mode, so
// they are lifted to named consts (behaviour unchanged) and referenced by both.
const pipelineSummaryTool: CopilotTool = {
  name: "pipeline_summary",
  description: "Count of leads in each pipeline stage.",
  input_schema: { type: "object", properties: {} },
  run: async (db) => {
    const { data, error } = await db.from("leads").select("stage").eq("organization_id", ORG_ID);
    return error ? { error: error.message } : { total: data.length, by_stage: groupCount(data, "stage") };
  },
};

const listDealsTool: CopilotTool = {
  name: "list_deals",
  description: "List closed deals with value and agent payout.",
  input_schema: { type: "object", properties: { limit: { type: "number" } } },
  run: async (db, i) => {
    const { data, error } = await db
      .from("deals")
      .select("client_name,value_omr,payout_omr,closed_at,developer_paid,agent_paid")
      .eq("organization_id", ORG_ID)
      .order("closed_at", { ascending: false })
      .limit(num(i.limit));
    return error ? { error: error.message } : { count: data.length, deals: data };
  },
};

const salesTools: CopilotTool[] = [
  pipelineSummaryTool,
  {
    name: "list_leads",
    description: "List leads, optionally filtered by stage (new, qualified, engaged, viewing, negotiation, reservation, closed_won, closed_lost).",
    input_schema: { type: "object", properties: { stage: { type: "string" }, limit: { type: "number" } } },
    run: async (db, i) => {
      let q = db
        .from("leads")
        .select("name,phone_e164,country,nationality,budget_min_omr,budget_max_omr,stage,source,last_touch_at")
        .eq("organization_id", ORG_ID)
        .order("created_at", { ascending: false })
        .limit(num(i.limit));
      if (i.stage) q = q.eq("stage", i.stage as string);
      const { data, error } = await q;
      return error ? { error: error.message } : { count: data.length, leads: data };
    },
  },
  listDealsTool,
];
// (move_lead_stage is appended after the guarded write tools are defined below.)

const marketingTools: CopilotTool[] = [
  {
    name: "lead_source_breakdown",
    description: "Count of leads grouped by acquisition source (where leads came from).",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db.from("leads").select("source").eq("organization_id", ORG_ID);
      return error ? { error: error.message } : { total: data.length, by_source: groupCount(data, "source") };
    },
  },
  {
    name: "leads_by_month",
    description: "New leads per month (YYYY-MM) — acquisition trend.",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db.from("leads").select("created_at").eq("organization_id", ORG_ID);
      if (error) return { error: error.message };
      const by: Record<string, number> = {};
      for (const r of data as { created_at: string }[]) {
        const m = (r.created_at ?? "").slice(0, 7);
        if (m) by[m] = (by[m] ?? 0) + 1;
      }
      return { by_month: by };
    },
  },
  {
    name: "top_interest_projects",
    description: "Which projects leads are most interested in.",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db
        .from("leads")
        .select("projects(name)")
        .eq("organization_id", ORG_ID)
        .not("interest_project_id", "is", null);
      if (error) return { error: error.message };
      const by = groupCount(
        (data as { projects?: { name?: string } }[]).map((r) => ({ p: r.projects?.name ?? "unknown" })),
        "p",
      );
      return { by_project: by };
    },
  },
  {
    name: "save_content_draft",
    description: "Save a generated content draft to the content library for review/publishing.",
    input_schema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["instagram", "tiktok", "youtube", "linkedin", "whatsapp"] },
        title: { type: "string", description: "Short draft title" },
        content: { type: "string", description: "The full draft" },
        content_type: { type: "string", description: "e.g. hook, carousel, reel_script, caption, post" },
      },
      required: ["platform", "title", "content"],
    },
    run: async (db, input) => {
      const { data, error } = await db
        .from("department_tasks")
        .insert({
          organization_id: ORG_ID,
          from_department: "marketing",
          to_department: "marketing",
          title: `[CONTENT/${input.platform}] ${input.title}`,
          detail: input.content,
          priority: "normal",
        })
        .select("id,title,detail,priority,status,created_at")
        .single();
      return error ? { error: error.message } : { saved: true, task: data };
    },
  },
  {
    name: "list_content_drafts",
    description: "List saved content drafts (the content library).",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db
        .from("department_tasks")
        .select("id,title,detail,priority,status,created_at")
        .eq("organization_id", ORG_ID)
        .eq("to_department", "marketing")
        .like("title", "[CONTENT%")
        .order("created_at", { ascending: false })
        .limit(30);
      return error ? { error: error.message } : { count: data?.length ?? 0, drafts: data };
    },
  },
];

const financeSummaryTool: CopilotTool = {
  name: "finance_summary",
  description: "Headline finance totals: invoiced, collected, outstanding, invoice count, overdue count.",
  input_schema: { type: "object", properties: {} },
  run: async (db) => {
    const inv = await db.from("invoices").select("amount_omr,status").eq("organization_id", ORG_ID);
    const col = await db.from("collections").select("amount_omr").eq("organization_id", ORG_ID);
    if (inv.error) return { error: inv.error.message };
    const invoiced = (inv.data as { amount_omr: number }[]).reduce((s, r) => s + Number(r.amount_omr || 0), 0);
    const collected = ((col.data as { amount_omr: number }[]) || []).reduce((s, r) => s + Number(r.amount_omr || 0), 0);
    const overdue = (inv.data as { status: string }[]).filter((r) => r.status === "overdue").length;
    return {
      invoiced_omr: invoiced,
      collected_omr: collected,
      outstanding_omr: invoiced - collected,
      invoice_count: inv.data.length,
      overdue_count: overdue,
    };
  },
};

const financeTools: CopilotTool[] = [
  financeSummaryTool,
  {
    name: "list_invoices",
    description: "List commission invoices, optionally by status (draft, sent, partially_paid, paid, overdue, cancelled).",
    input_schema: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } },
    run: async (db, i) => {
      let q = db
        .from("invoices")
        .select("reference,developer,amount_omr,status,issued_date,due_date")
        .eq("organization_id", ORG_ID)
        .order("due_date", { ascending: true })
        .limit(num(i.limit, 50, 200));
      if (i.status) q = q.eq("status", i.status as string);
      const { data, error } = await q;
      return error ? { error: error.message } : { count: data.length, invoices: data };
    },
  },
];

const hrTools: CopilotTool[] = [
  {
    name: "list_staff",
    description: "List staff with their role, status and monthly target.",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db
        .from("staff_profiles")
        .select("role,status,segment,monthly_target_omr,profiles(full_name)")
        .eq("organization_id", ORG_ID);
      return error ? { error: error.message } : { count: data.length, staff: data };
    },
  },
  {
    name: "pending_leave_requests",
    description: "Leave requests awaiting approval.",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db
        .from("leave_requests")
        .select("staff_id,start_date,end_date,reason,status")
        .eq("organization_id", ORG_ID)
        .eq("status", "pending")
        .limit(50);
      return error ? { error: error.message } : { count: data.length, requests: data };
    },
  },
  {
    name: "leave_catalog",
    description: "The configured leave types (Oman labour categories) with default day allowances.",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db
        .from("leave_types")
        .select("code,name_en,paid,default_days_per_year,oman_labour_note")
        .eq("organization_id", ORG_ID);
      return error ? { error: error.message } : { leave_types: data };
    },
  },
];

const inventorySummaryTool: CopilotTool = {
  name: "inventory_summary",
  description: "Count of units by status (available, reserved, sold).",
  input_schema: { type: "object", properties: {} },
  run: async (db) => {
    const { data, error } = await db.from("units").select("status").eq("organization_id", ORG_ID);
    return error ? { error: error.message } : { total: data.length, by_status: groupCount(data, "status") };
  },
};

const listUnitsTool: CopilotTool = {
  name: "list_units",
  description: "List inventory units, optionally by status.",
  input_schema: { type: "object", properties: { status: { type: "string" }, limit: { type: "number" } } },
  run: async (db, i) => {
    let q = db
      .from("units")
      .select("reference_id,unit_type,bedrooms,area_sqm,price_omr,status,projects(name,developer)")
      .eq("organization_id", ORG_ID)
      .limit(num(i.limit));
    if (i.status) q = q.eq("status", i.status as string);
    const { data, error } = await q;
    return error ? { error: error.message } : { count: data.length, units: data };
  },
};

const inventoryTools: CopilotTool[] = [inventorySummaryTool, listUnitsTool];

// ---- Guarded write tools ----------------------------------------------------
// Every write requires confirm:true. Without it the tool returns a preview and
// writes NOTHING — enforcing in code the personas' "state exactly what you will
// write and confirm first" contract, so a copilot can never act on a hunch.
const needsConfirm = (preview: Record<string, unknown>) => ({
  needs_confirmation: true,
  preview,
  note: "Nothing was written. State this change to the owner and repeat the call with confirm: true once they agree.",
});

const LEAD_STAGES = ["new", "qualified", "engaged", "viewing", "negotiation", "reservation", "closed_won", "closed_lost"];
const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"];
const UNIT_STATUSES = ["available", "reserved", "sold"];

export const moveLeadStageTool: CopilotTool = {
  name: "move_lead_stage",
  description:
    "GUARDED WRITE — move a lead to another pipeline stage. Finds the lead by phone (exact) or name (partial). Without confirm:true it only previews; ambiguous matches are returned as candidates, never written.",
  input_schema: {
    type: "object",
    properties: {
      lead: { type: "string", description: "Lead phone (E.164) or name (exact or partial)" },
      stage: { type: "string", enum: LEAD_STAGES },
      confirm: { type: "boolean", description: "true only after the owner confirmed the exact change" },
    },
    required: ["lead", "stage"],
  },
  run: async (db, i) => {
    const stage = String(i.stage ?? "");
    const needle = String(i.lead ?? "").trim();
    if (!LEAD_STAGES.includes(stage)) return { error: `invalid stage '${stage}'` };
    if (!needle) return { error: "lead is required" };
    let { data, error } = await db
      .from("leads")
      .select("id,name,phone_e164,stage")
      .eq("organization_id", ORG_ID)
      .eq("phone_e164", needle)
      .limit(5);
    if (error) return { error: error.message };
    if (!data?.length) {
      ({ data, error } = await db
        .from("leads")
        .select("id,name,phone_e164,stage")
        .eq("organization_id", ORG_ID)
        .ilike("name", `%${needle.replace(/[%_,()]/g, "")}%`)
        .limit(5));
      if (error) return { error: error.message };
    }
    const rows = (data ?? []) as { id: string; name: string; phone_e164: string | null; stage: string }[];
    if (rows.length === 0) return { error: `no lead matches '${needle}'` };
    if (rows.length > 1) return { ambiguous: true, candidates: rows, note: "Narrow the search — nothing was written." };
    const lead = rows[0];
    if (lead.stage === stage) return { unchanged: true, lead: lead.name, stage };
    if (i.confirm !== true) return needsConfirm({ lead: lead.name, phone: lead.phone_e164, from: lead.stage, to: stage });
    const upd = await db
      .from("leads")
      .update({ stage, last_touch_at: new Date().toISOString() })
      .eq("id", lead.id)
      .select("id,name,stage")
      .single();
    return upd.error ? { error: upd.error.message } : { updated: true, lead: upd.data };
  },
};

export const decideLeaveRequestTool: CopilotTool = {
  name: "decide_leave_request",
  description:
    "GUARDED WRITE — approve or reject a pending leave request by its id (from pending_leave_requests). Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      request_id: { type: "string", description: "leave_requests.id (uuid)" },
      decision: { type: "string", enum: ["approve", "reject"] },
      confirm: { type: "boolean" },
    },
    required: ["request_id", "decision"],
  },
  run: async (db, i) => {
    const decision = String(i.decision ?? "");
    if (decision !== "approve" && decision !== "reject") return { error: "decision must be approve or reject" };
    const { data, error } = await db
      .from("leave_requests")
      .select("id,staff_id,start_date,end_date,reason,status")
      .eq("organization_id", ORG_ID)
      .eq("id", String(i.request_id ?? ""))
      .single();
    if (error) return { error: error.message };
    const req = data as { id: string; staff_id: string; start_date: string; end_date: string; status: string };
    if (req.status !== "pending") return { error: `request is already '${req.status}' — only pending requests can be decided` };
    if (i.confirm !== true)
      return needsConfirm({ request_id: req.id, staff_id: req.staff_id, dates: `${req.start_date} → ${req.end_date}`, decision });
    const upd = await db
      .from("leave_requests")
      .update({ status: decision === "approve" ? "approved" : "rejected", approved_at: new Date().toISOString() })
      .eq("id", req.id)
      .select("id,status")
      .single();
    return upd.error ? { error: upd.error.message } : { updated: true, request: upd.data };
  },
};

export const updateInvoiceStatusTool: CopilotTool = {
  name: "update_invoice_status",
  description:
    "GUARDED WRITE — set a commission invoice's status by its reference (draft, sent, partially_paid, paid, overdue, cancelled). Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      reference: { type: "string", description: "Invoice reference exactly as listed" },
      status: { type: "string", enum: INVOICE_STATUSES },
      confirm: { type: "boolean" },
    },
    required: ["reference", "status"],
  },
  run: async (db, i) => {
    const status = String(i.status ?? "");
    if (!INVOICE_STATUSES.includes(status)) return { error: `invalid status '${status}'` };
    const { data, error } = await db
      .from("invoices")
      .select("id,reference,developer,amount_omr,status")
      .eq("organization_id", ORG_ID)
      .eq("reference", String(i.reference ?? ""))
      .limit(5);
    if (error) return { error: error.message };
    const rows = (data ?? []) as { id: string; reference: string; developer: string | null; amount_omr: number; status: string }[];
    if (rows.length === 0) return { error: `no invoice with reference '${i.reference}'` };
    if (rows.length > 1) return { ambiguous: true, candidates: rows, note: "Reference matches several invoices — nothing was written." };
    const inv = rows[0];
    if (inv.status === status) return { unchanged: true, reference: inv.reference, status };
    if (i.confirm !== true)
      return needsConfirm({ reference: inv.reference, developer: inv.developer, amount_omr: inv.amount_omr, from: inv.status, to: status });
    const upd = await db.from("invoices").update({ status }).eq("id", inv.id).select("id,reference,status").single();
    return upd.error ? { error: upd.error.message } : { updated: true, invoice: upd.data };
  },
};

export const recordCollectionTool: CopilotTool = {
  name: "record_collection",
  description:
    "GUARDED WRITE — record commission cash received from a developer (a collections row), optionally linked to an invoice by reference. Amounts are OMR. Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      amount_omr: { type: "number", description: "Amount received, OMR" },
      invoice_reference: { type: "string", description: "Optional invoice reference to link" },
      received_date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
      method: { type: "string", description: "e.g. bank transfer, cheque" },
      reference: { type: "string", description: "Payment reference / transaction id" },
      confirm: { type: "boolean" },
    },
    required: ["amount_omr"],
  },
  run: async (db, i) => {
    const amount = Number(i.amount_omr);
    if (!Number.isFinite(amount) || amount <= 0) return { error: "amount_omr must be a positive number" };
    let invoiceId: string | null = null;
    let invoiceLabel: string | null = null;
    if (i.invoice_reference) {
      const { data, error } = await db
        .from("invoices")
        .select("id,reference,amount_omr")
        .eq("organization_id", ORG_ID)
        .eq("reference", String(i.invoice_reference))
        .limit(5);
      if (error) return { error: error.message };
      const rows = (data ?? []) as { id: string; reference: string }[];
      if (rows.length === 0) return { error: `no invoice with reference '${i.invoice_reference}'` };
      if (rows.length > 1) return { ambiguous: true, candidates: rows, note: "Reference matches several invoices — nothing was written." };
      invoiceId = rows[0].id;
      invoiceLabel = rows[0].reference;
    }
    const received = (i.received_date as string) || new Date().toISOString().slice(0, 10);
    if (i.confirm !== true)
      return needsConfirm({ amount_omr: amount, invoice: invoiceLabel, received_date: received, method: i.method ?? null });
    const ins = await db
      .from("collections")
      .insert({
        organization_id: ORG_ID,
        invoice_id: invoiceId,
        amount_omr: amount,
        received_date: received,
        method: (i.method as string) ?? null,
        reference: (i.reference as string) ?? null,
      })
      .select("id,amount_omr,received_date")
      .single();
    return ins.error ? { error: ins.error.message } : { recorded: true, collection: ins.data };
  },
};

export const updateUnitStatusTool: CopilotTool = {
  name: "update_unit_status",
  description:
    "GUARDED WRITE — set a unit's availability (available, reserved, sold) by its reference_id. Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      reference_id: { type: "string", description: "The unit's reference_id exactly as listed" },
      status: { type: "string", enum: UNIT_STATUSES },
      confirm: { type: "boolean" },
    },
    required: ["reference_id", "status"],
  },
  run: async (db, i) => {
    const status = String(i.status ?? "");
    if (!UNIT_STATUSES.includes(status)) return { error: `invalid status '${status}'` };
    const { data, error } = await db
      .from("units")
      .select("id,reference_id,unit_type,status,projects(name)")
      .eq("organization_id", ORG_ID)
      .eq("reference_id", String(i.reference_id ?? ""))
      .limit(5);
    if (error) return { error: error.message };
    const rows = (data ?? []) as { id: string; reference_id: string; status: string }[];
    if (rows.length === 0) return { error: `no unit with reference_id '${i.reference_id}'` };
    if (rows.length > 1) return { ambiguous: true, candidates: rows, note: "reference_id matches several units — nothing was written." };
    const unit = rows[0];
    if (unit.status === status) return { unchanged: true, reference_id: unit.reference_id, status };
    if (i.confirm !== true) return needsConfirm({ reference_id: unit.reference_id, from: unit.status, to: status });
    const upd = await db.from("units").update({ status }).eq("id", unit.id).select("id,reference_id,status").single();
    return upd.error ? { error: upd.error.message } : { updated: true, unit: upd.data };
  },
};

// ---- Revenue recovery (collections chase) -----------------------------------
// The deal-to-cash chain: verified due dates → deterministic aging → linked
// deals → approved follow-ups. Aging math is pure domain code, never the model.

export const listCollectionQueueTool: CopilotTool = {
  name: "list_collection_queue",
  description:
    "The collections chase queue: open commission invoices with deterministic aging (not-yet-due / due-soon / overdue buckets / due-date-unverified), sorted worst first. Chase from the top; fix unverified due dates with set_invoice_due_date before treating them as overdue.",
  input_schema: { type: "object", properties: { limit: { type: "number" } } },
  run: async (db, i) => {
    const { data, error } = await db
      .from("invoices")
      .select("reference,developer,amount_omr,status,due_date")
      .eq("organization_id", ORG_ID)
      .in("status", [...OPEN_INVOICE_STATUSES]);
    if (error) return { error: error.message };
    const summary = summarizeAging(
      (data as { reference: string | null; developer: string | null; amount_omr: number | string; status: string; due_date: string | null }[]).map(
        (r) => ({
          reference: r.reference,
          developer: r.developer,
          amountOmr: Number(r.amount_omr || 0),
          status: r.status,
          dueDate: r.due_date,
        }),
      ),
      new Date(),
    );
    return {
      buckets: Object.fromEntries(
        Object.entries(summary.buckets).map(([k, v]) => [AGING_BUCKET_LABELS[k as keyof typeof AGING_BUCKET_LABELS], v]),
      ),
      open_count: summary.openCount,
      open_amount_omr: summary.openAmountOmr,
      overdue_count: summary.overdueCount,
      overdue_amount_omr: summary.overdueAmountOmr,
      queue: summary.queue.slice(0, num(i.limit, 15, 50)),
      note: "Overdue = verified due date in the past. 'Due date unverified' rows need set_invoice_due_date (with the contractual basis) before chasing as overdue.",
    };
  },
};

export const linkInvoiceToDealTool: CopilotTool = {
  name: "link_invoice_to_deal",
  description:
    "GUARDED WRITE — link a commission invoice to the closed deal that earned it (by invoice reference + deal client name). Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      invoice_reference: { type: "string" },
      client_name: { type: "string", description: "Client name on the deal (exact or partial)" },
      note: { type: "string" },
      confirm: { type: "boolean" },
    },
    required: ["invoice_reference", "client_name"],
  },
  run: async (db, i) => {
    const inv = await db
      .from("invoices")
      .select("id,reference,developer,amount_omr")
      .eq("organization_id", ORG_ID)
      .eq("reference", String(i.invoice_reference ?? ""))
      .limit(5);
    if (inv.error) return { error: inv.error.message };
    const invoices = (inv.data ?? []) as { id: string; reference: string; developer: string | null; amount_omr: number }[];
    if (invoices.length === 0) return { error: `no invoice with reference '${i.invoice_reference}'` };
    if (invoices.length > 1) return { ambiguous: true, candidates: invoices, note: "Reference matches several invoices — nothing was written." };

    const deal = await db
      .from("deals")
      .select("id,client_name,value_omr,closed_at")
      .eq("organization_id", ORG_ID)
      .ilike("client_name", `%${String(i.client_name ?? "").replace(/[%_,()]/g, "")}%`)
      .not("external_id", "is", null)
      .limit(5);
    if (deal.error) return { error: deal.error.message };
    const deals = (deal.data ?? []) as { id: string; client_name: string | null; value_omr: number; closed_at: string | null }[];
    if (deals.length === 0) return { error: `no deal matches client '${i.client_name}'` };
    if (deals.length > 1) return { ambiguous: true, candidates: deals, note: "Several deals match — narrow the client name. Nothing was written." };

    if (i.confirm !== true)
      return needsConfirm({ invoice: invoices[0].reference, deal_client: deals[0].client_name, deal_value_omr: deals[0].value_omr });
    const ins = await db
      .from("invoice_deal_links")
      .insert({
        organization_id: ORG_ID,
        invoice_id: invoices[0].id,
        deal_id: deals[0].id,
        source: "copilot",
        note: (i.note as string) ?? null,
      })
      .select("id")
      .single();
    if (ins.error) {
      return ins.error.message.includes("duplicate")
        ? { unchanged: true, note: "This invoice is already linked to that deal." }
        : { error: ins.error.message };
    }
    return { linked: true, invoice: invoices[0].reference, deal_client: deals[0].client_name };
  },
};

export const setInvoiceDueDateTool: CopilotTool = {
  name: "set_invoice_due_date",
  description:
    "GUARDED WRITE — set and VERIFY an invoice's due date. Requires the contractual basis (e.g. '45 days from SPA per agreement'); a due date is never guessed. Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      invoice_reference: { type: "string" },
      due_date: { type: "string", description: "YYYY-MM-DD" },
      basis: { type: "string", description: "Where this due date comes from — contract term, Zoho terms, developer confirmation" },
      confirm: { type: "boolean" },
    },
    required: ["invoice_reference", "due_date", "basis"],
  },
  run: async (db, i) => {
    const due = String(i.due_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(new Date(`${due}T00:00:00Z`).getTime()))
      return { error: "due_date must be a valid YYYY-MM-DD date" };
    const basis = String(i.basis ?? "").trim();
    if (!basis) return { error: "basis is required — a due date without provenance stays unverified" };
    const { data, error } = await db
      .from("invoices")
      .select("id,reference,due_date,status")
      .eq("organization_id", ORG_ID)
      .eq("reference", String(i.invoice_reference ?? ""))
      .limit(5);
    if (error) return { error: error.message };
    const rows = (data ?? []) as { id: string; reference: string; due_date: string | null; status: string }[];
    if (rows.length === 0) return { error: `no invoice with reference '${i.invoice_reference}'` };
    if (rows.length > 1) return { ambiguous: true, candidates: rows, note: "Reference matches several invoices — nothing was written." };
    if (i.confirm !== true)
      return needsConfirm({ invoice: rows[0].reference, from: rows[0].due_date ?? "(unset)", to: due, basis });
    const upd = await db
      .from("invoices")
      .update({ due_date: due, due_date_verified: true, due_date_basis: basis })
      .eq("id", rows[0].id)
      .select("id,reference,due_date")
      .single();
    return upd.error
      ? { error: `${upd.error.message} (migration 0009 may not be applied yet)` }
      : { updated: true, invoice: upd.data, verified: true };
  },
};

const FOLLOWUP_KINDS = [
  "due_reminder", "first_overdue", "second_escalation", "management_escalation",
  "dispute_clarification", "partial_balance", "remittance_confirmation",
];

export const createCollectionFollowupTool: CopilotTool = {
  name: "create_collection_followup",
  description:
    "GUARDED WRITE — record an approved collection follow-up for an invoice: the kind of chase and the exact message wording. Respond.io is NOT connected: the follow-up is stored as an approved draft for the owner to copy and send, then log with log_collection_contact. Never accuse a payer of default without verified terms. Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      invoice_reference: { type: "string" },
      kind: { type: "string", enum: FOLLOWUP_KINDS },
      message: { type: "string", description: "The exact wording to send (no internal commission details beyond the invoice itself)" },
      due_at: { type: "string", description: "Optional YYYY-MM-DD when this chase should happen" },
      confirm: { type: "boolean" },
    },
    required: ["invoice_reference", "kind", "message"],
  },
  run: async (db, i) => {
    const kind = String(i.kind ?? "");
    if (!FOLLOWUP_KINDS.includes(kind)) return { error: `kind must be one of: ${FOLLOWUP_KINDS.join(", ")}` };
    const message = String(i.message ?? "").trim();
    if (!message) return { error: "message is required — the owner approves exact wording, not an intention" };
    const { data, error } = await db
      .from("invoices")
      .select("id,reference,developer,amount_omr,status,due_date")
      .eq("organization_id", ORG_ID)
      .eq("reference", String(i.invoice_reference ?? ""))
      .limit(5);
    if (error) return { error: error.message };
    const rows = (data ?? []) as { id: string; reference: string; developer: string | null; amount_omr: number; status: string; due_date: string | null }[];
    if (rows.length === 0) return { error: `no invoice with reference '${i.invoice_reference}'` };
    if (rows.length > 1) return { ambiguous: true, candidates: rows, note: "Reference matches several invoices — nothing was written." };
    if (i.confirm !== true)
      return needsConfirm({ invoice: rows[0].reference, payer: rows[0].developer, kind, message });
    const ins = await db
      .from("collection_followups")
      .insert({
        organization_id: ORG_ID,
        invoice_id: rows[0].id,
        kind,
        status: "approved",
        channel: "whatsapp_draft",
        message,
        due_at: i.due_at ? `${String(i.due_at)}T09:00:00Z` : null,
      })
      .select("id,kind,status")
      .single();
    return ins.error
      ? { error: `${ins.error.message} (migration 0009 may not be applied yet)` }
      : {
          recorded: true,
          followup: ins.data,
          note: "Respond.io not connected — draft only. Copy the message, send it manually, then log the send with log_collection_contact.",
        };
  },
};

export const logCollectionContactTool: CopilotTool = {
  name: "log_collection_contact",
  description:
    "GUARDED WRITE — log that a collection follow-up was actually sent, and/or the payer's response. Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: {
      followup_id: { type: "string", description: "collection_followups.id (from list results)" },
      outcome: { type: "string", enum: ["sent", "responded"] },
      response: { type: "string", description: "What the payer said (when outcome is responded)" },
      confirm: { type: "boolean" },
    },
    required: ["followup_id", "outcome"],
  },
  run: async (db, i) => {
    const outcome = String(i.outcome ?? "");
    if (outcome !== "sent" && outcome !== "responded") return { error: "outcome must be sent or responded" };
    const { data, error } = await db
      .from("collection_followups")
      .select("id,kind,status,invoice_id")
      .eq("organization_id", ORG_ID)
      .eq("id", String(i.followup_id ?? ""))
      .single();
    if (error) return { error: `${error.message} (migration 0009 may not be applied yet)` };
    const fu = data as { id: string; kind: string; status: string };
    if (i.confirm !== true) return needsConfirm({ followup: fu.id, kind: fu.kind, from: fu.status, to: outcome });
    const patch =
      outcome === "sent"
        ? { status: "sent", sent_at: new Date().toISOString() }
        : { status: "responded", response: (i.response as string) ?? null };
    const upd = await db.from("collection_followups").update(patch).eq("id", fu.id).select("id,status").single();
    return upd.error ? { error: upd.error.message } : { updated: true, followup: upd.data };
  },
};

export const completeTaskTool: CopilotTool = {
  name: "complete_task",
  description: "GUARDED WRITE — mark a handed-off task (from list_my_inbox) as done by its id. Without confirm:true it only previews.",
  input_schema: {
    type: "object",
    properties: { task_id: { type: "string" }, confirm: { type: "boolean" } },
    required: ["task_id"],
  },
  run: async (db, i, deptId) => {
    const { data, error } = await db
      .from("department_tasks")
      .select("id,title,status,to_department")
      .eq("organization_id", ORG_ID)
      .eq("id", String(i.task_id ?? ""))
      .single();
    if (error) return { error: error.message };
    const task = data as { id: string; title: string; status: string; to_department: string };
    if (task.to_department !== deptId) return { error: `task belongs to '${task.to_department}', not this department` };
    if (task.status === "done") return { unchanged: true, task: task.title };
    if (i.confirm !== true) return needsConfirm({ task: task.title, from: task.status, to: "done" });
    const upd = await db.from("department_tasks").update({ status: "done" }).eq("id", task.id).select("id,title,status").single();
    return upd.error ? { error: upd.error.message } : { updated: true, task: upd.data };
  },
};

// Expert Mode reads across departments (inventory + prices, pipeline + deals,
// finance context) but writes nothing itself — the same read tools, reused.
const expertTools: CopilotTool[] = [
  inventorySummaryTool,
  listUnitsTool,
  pipelineSummaryTool,
  listDealsTool,
  financeSummaryTool,
];

// Wire the guarded writes into their departments (Expert Mode stays read-only).
salesTools.push(moveLeadStageTool);
hrTools.push(decideLeaveRequestTool);
financeTools.push(
  listCollectionQueueTool,
  updateInvoiceStatusTool,
  recordCollectionTool,
  linkInvoiceToDealTool,
  setInvoiceDueDateTool,
  createCollectionFollowupTool,
  logCollectionContactTool,
);
inventoryTools.push(updateUnitStatusTool);

const withShared = (tools: CopilotTool[]) => [...tools, inbox, handoff, completeTaskTool];

const FINANCE_SYSTEM = `You are the Finance copilot (Chief Finance Officer) for Alwalaa Real Estate — legal entity Alwalaa Leading Projects SPC (CR 1386871, VATIN OM1100425149). You own the company's own money: commission invoicing, collections, agent payouts, VAT, payroll and the owner's finance picture.

What you do:
- Read live figures with finance_summary and list_invoices (and list_my_inbox) before answering; quote exact OMR, never rounded guesses.
- Commission model: Alwalaa earns 3-4% of property value (ex-VAT) from the developer; the agent's share of Alwalaa's net is 25% standard, 35% senior, 50% on referral leads; the referral introducer gets 1%. A deal is booked only after Sulaiman validates it.
- Track what matters, worst first: invoiced vs collected vs outstanding, overdue invoices, and closed deals not yet invoiced — chase these before anything else. Outstanding is NOT the same as overdue: only a verified due date in the past is overdue; use list_collection_queue for the deterministic aging buckets, and fix "due date unverified" rows with set_invoice_due_date (always with the contractual basis) before chasing them.
- The chase discipline: verify the due date and amount → draft the exact message → get the owner's confirmation → create_collection_followup (stored as an approved draft; Respond.io is not connected, so the owner sends it manually) → log_collection_contact when sent and when the payer responds. Link every invoice to its deal with link_invoice_to_deal so entitlement is traceable. Never accuse a payer of default without verified contractual terms.
- On request, give the weekly finance brief: cash position, what came in, what is overdue, payables needing the owner's approval, and the one decision he must make.
- Watch VAT (the company is registered) and keep personal and company cash separate — flag any owner-funded expense that should be reimbursed or booked as an owner loan.

How you act (do-er + advisor): compute, draft and recommend directly. To record a collection or change an invoice's status, first state exactly what you will write (amount, party, reference) and confirm; then use record_collection / update_invoice_status (they preview until you pass confirm:true). To raise a new invoice or schedule a payout, hand off with handoff_to_department. Never stop at "I can't."

What you do NOT do: no client-facing investor ROI/yield/underwriting (that is Advisory); no agent coaching or commission-scheme design (Sales/HR). You flag tax and Omani-law questions and verify them — you are not the accountant or lawyer of record.`;

const SALES_SYSTEM = `You are the Sales copilot (Chief Sales Officer) for Alwalaa Real Estate — luxury Oman ITC freehold sold to foreign investors for Golden/Investor Residency and ROI. You own the lead pipeline and the closing of deals: intake, qualification, stage movement, follow-up discipline, and turning viewings into booked sales.

What you do:
- Read pipeline_summary for the live count of leads at each stage before you quote a single number — never describe pipeline health from memory.
- Pull list_leads filtered by stage (new, qualified, engaged, viewing, negotiation, reservation, closed_won, closed_lost) to build prioritized follow-up lists and surface stale stages and overdue touches.
- Pull list_deals for closed deals with their value and agent payout whenever you report production, per-agent property value, or momentum.
- Scan list_my_inbox for new WhatsApp-first leads and Lead Validation Form entries from referrals, Instagram, and portals (Dubizzle, OpenSooq) that need qualifying and routing.
- Measure the team against its standing targets: 250,000 OMR/month in property value per agent, 3,000 OMR/month in net commission per agent, and about 10 new clients/month.
- Watch pipeline hygiene — flag stale stages and overdue follow-ups the moment the stage data shows them.

How you act (do-er + advisor):
- Qualify and route incoming leads by source and fit, and prep prioritized, agent-by-agent follow-up lists.
- Qualify nationality early — non-GCC buyers are ITC-only; do not advance a non-GCC lead on a Future City or Surooh unit.
- Diagnose why the pipeline is stalling — velocity fell after the February peak — and prep the sales meeting off live numbers, not impressions.
- Name concentration risk plainly: the book leans heavily on the single top closer; advise on rebalancing leads and coaching each agent toward target.
- To move a lead's stage, state exactly what you will write and confirm first — then use move_lead_stage (it previews until you pass confirm:true). For assignment changes or logging a deal, hand off with handoff_to_department. A deal is booked only after Sulaiman validates it.

What you do NOT do:
- Company finance and commission accounting — that is Finance. The 3-4% developer fee and the 25/35/50% agent-net split are internal context only; never quote them to a client.
- Listing marketing copy or channel spend — that is Marketing.
- Client-facing ROI, yield, or underwriting — that is Advisory / Expert Mode.
- HR and people matters — that is People.`;

const MARKETING_SYSTEM = `You are the Marketing copilot (Chief Marketing Officer) for Alwalaa Real Estate. You own lead generation and channel performance — where qualified investor leads come from, which projects they want most, and where the next rial of spend and hour of content should go.

What you do:
You market Oman ITC freehold to foreign investors — a GCC/UAE-skewed audience plus the UK, India, Pakistan, Egypt and Europe — who buy for Golden/Investor Residency and ROI, with Wadi Zaha in Sultan Haitham City as the flagship. You run the channel mix: WhatsApp as the primary lead line, Instagram (@alwalaa.om), the property portals (Dubizzle, OpenSooq, Bayut, OLX), the website (alwalaaoman.com), plus YouTube and LinkedIn. Before quoting any number, you read the live tools: lead_source_breakdown for leads by acquisition source, leads_by_month for the new-lead trend by month, and top_interest_projects for demand by project; list_my_inbox shows what is waiting on you.

How you act (do-er + advisor):
You diagnose which sources and projects actually convert, then tell the owner plainly where to concentrate spend and content — and where to cut, as one clear call rather than a menu. You plan campaigns and the content calendar against real demand, and route qualified leads to Sales with handoff_to_department. Client-facing content holds the red lines: price ranges only, never exact internal prices, no residency guarantees or decree numbers, and never expose commissions. Never target non-GCC foreign audiences with Future Cities (Sultan Haitham City / Wadi Zaha) or Surooh ownership or residency messaging — those are GCC/Omani-only; foreign-investor campaigns run on ITC projects. You advise freely, but to launch a campaign, publish a post, or commit spend, you state exactly what will go out and confirm first. Heavy production — full videos, carousels, long-form copy — you brief and hand to the content specialists rather than grinding it out yourself.

What you do NOT do:
You do not close or manage the pipeline (that is Sales), touch company money or payouts (Finance), produce client-facing ROI or underwriting (Advisory / Expert Mode), or run HR. When a request crosses one of those lines, hand it off rather than guess.

Content engine:
You are also the content engine — when asked for content, you write it yourself, in full, ready to post.

Platform playbook:
- Instagram (@alwalaa.om): reels 15-45s with the hook in the first 2 seconds; carousels 6-10 slides, each slide one idea; captions front-load the value, end with a CTA, and carry 5-8 niche hashtags.
- TikTok: native feel over polish — text overlay hook on screen, three acts: hook, proof, CTA.
- YouTube: walkthroughs and investor explainers; the title is benefit + specificity.
- LinkedIn: authority POV posts; no hashtag spam — 1-3 hashtags at most.
- WhatsApp remains the lead line — every CTA on every platform routes to WhatsApp.

Hook frameworks:
- Contrarian: "Everyone thinks X about Oman property — here's what the data says."
- Specific-number: "What 585K OMR of outstanding invoices taught me."
- Eligibility-myth: "You don't need to be GCC to own in Oman — in these zones."
- POV-founder: first-person from the founder's seat.

Content pillars (grounded in the business):
1. ITC freehold education + Golden/Investor Residency.
2. Project spotlights driven by live top_interest_projects data.
3. Founder / behind-the-scenes.
4. Market proof — lead trends via leads_by_month.
5. Client-journey stories, always anonymized.

Content rules:
- Draft with live data from your tools first; NEVER invent figures.
- Price ranges only — no exact internal prices.
- No residency guarantees. Never expose commissions.
- Non-GCC-targeted content must only feature ITC projects — never SHC/Wadi Zaha/Surooh ownership or residency claims.
- Save every approved draft with save_content_draft.

Workflow: when asked for content, produce the full pack — hook + body/script + caption + hashtags + CTA — then offer to save it to the library with save_content_draft; use list_content_drafts to review what is already in the library.`;

const HR_SYSTEM = `You are the HR & Admin copilot (Chief People Officer) for Alwalaa Real Estate — legal entity Alwalaa Leading Projects SPC (CR 1386871, VATIN OM1100425149). You own the people: staff records, Oman-labour leave, attendance, performance and hiring. This is a small team run by a part-time owner-CEO, so you keep everything lean and practical rather than corporate.

What you do:
- Own the live roster, the pending-leave queue and the leave catalog — read them before you answer anything about who works here, their role, status, segment, target or time off.
- Run hiring at a founder's scale: define the role, draft the job description, structure the interview, and frame the offer within Omani-labour terms.
- Prepare the people work — scorecards, review talking points, onboarding and 1:1 structure — as one-page documents with plain Below/Meets/Exceeds ratings.
- Track leave and attendance against the configured Oman-labour allowances, and run performance on quarterly cycles with no more than three to five KPIs per role.
- Keep every person's file complete: a current signed contract, a valid civil ID and visa, an up-to-date role and target, and a documented review trail.
- State in one line, whenever it comes up, that this is consented HR performance data — records, attendance, leave, documented reviews — not covert or continuous surveillance.
- Proactively flag expiring civil IDs, visas and contracts, anyone working without a current contract, and underperformance nobody is documenting — an undocumented history makes lawful action much harder in Oman.

How you act (do-er + advisor):
- Read list_staff, pending_leave_requests and leave_catalog first, then answer; use list_my_inbox for what is waiting on you and handoff_to_department when the request belongs to another desk.
- To approve or reject a leave request, state exactly what you will write — the person, the dates, the decision — and confirm; then use decide_leave_request (it previews until you pass confirm:true). Other staff-record changes go through handoff_to_department.
- Omani Labour Law (Royal Decree 53/2023) governs contracts, leave, probation and termination — flag it when it bears on the answer and verify the current rule; never present a legal specific from memory as fact.
- Keep anything termination-adjacent to a DRAFT only, and attach a line telling the owner to have a lawyer verify it against current Omani Labour Law — you never stand in for a lawyer on termination.
- When you flag an expiry or a gap, propose the fix — the renewal to start, the contract to issue, the review to schedule — rather than only raising it.

What you do NOT do:
- You do not underwrite deals or run market and investment analysis (Advisory), and you do not touch listing or inventory operations (Inventory).
- You do not run company finances or payouts (Finance), produce marketing content, or build software — hand each of these to the right desk.`;

const INVENTORY_SYSTEM = `You are the Inventory copilot (Head of Inventory) for Alwalaa Real Estate — legal entity Alwalaa Leading Projects SPC — the luxury brokerage that curates Oman ITC freehold property and sells it to foreign investors. You own the property inventory end to end: the units, their availability, and the developer stock behind them, across ITC projects like Wadi Zaha (Sultan Haitham City), AIDA (Yiti), LUMA and Muscat Bay, Bellevue and Vistal (Al Mouj), and Jebel Sifah. You are the single source of truth for what the agency can actually sell right now.

What you do:
- Answer availability, stock, and unit questions from live tools only: inventory_summary for counts by status, and list_units to filter by status and pull each unit's reference_id, unit_type, bedrooms, area_sqm, price_omr, and its project and developer. Read live before you quote any count or price — never recite a number from memory.
- Track the four things that matter: what is available to sell today, what is aging or overhung, coverage gaps where a live project carries no loaded stock, and status accuracy across available, hold, reserved, and sold.
- Keep statuses honest so Sales and Expert Mode always quote reality — a unit still marked available that is really reserved is a live risk; flag it.
- Read your queue with list_my_inbox, and use handoff_to_department to route anything that belongs to Sales, Advisory, Marketing, or Finance.

How you act (do-er + advisor):
- Lead with the answer, then the detail: summarize availability and aging, and tell the owner plainly what to push, what to hold, and what is going stale.
- Prepare clean, accurate unit facts when a listing or a pitch needs them, so whoever faces the client is quoting your numbers, not guesses.
- To change a unit's availability, state exactly what you will write — which unit, from which status to which — and confirm; then use update_unit_status (it previews until you pass confirm:true). Publishing/feed changes go through handoff_to_department.
- Surface coverage gaps and overhang unprompted; do not wait to be asked which projects are running thin.

What you do NOT do:
- No client-facing ROI, yield, or underwriting, and no pricing strategy — that is Advisory / Expert Mode.
- No listing marketing copy or channel decisions — that is Marketing.
- No closing, follow-ups, or pipeline management — that is Sales.
- No company cash, commissions, or P&L — that is Finance. You keep the inventory true; the other desks act on it.`;

const EXPERT_SYSTEM = `You are Expert Mode — the senior real-estate investment expert and deal-closer for Alwalaa Real Estate. This is the mode the owner switches into to close a specific deal. You carry full command of Oman ITC freehold: ROI math (gross and net rental yield, capital appreciation), payment plans, residency-by-investment, and every investor category — capital growth, rental income, flip and assignment, lifestyle and second home, branded-residence premium, and residency.

What you do:
- Pull real, current units and prices with your tools before building any case: inventory_summary and list_units for what is actually available and its price, pipeline_summary and list_deals for what is selling, and finance_summary for context. Never quote a unit or price from memory.
- Match a real available unit to the investor's budget and goal, then build the return case and the tailored recommendation and pitch.
- Residency ladder — state it as guidance, never a guarantee, since final eligibility is decided by the Royal Oman Police: a property at or above 50,000 OMR can support a 2-year investor residency; at or above 200,000 OMR a 10-year Golden Residency; family residency on a Sultan Haitham City unit above 50,000 OMR typically needs 30 percent paid. Typical plan: 5 percent reservation, 15 percent down, balance over 5 years. Convert with 1 OMR is about 2.60 USD.
- Check nationality against eligibility before building any case: a non-GCC investor can buy ITC only — never build a residency or ownership case on a Future City (Sultan Haitham City, including Wadi Zaha) or a Surooh project for a non-GCC buyer; steer them to ITC.
- Rental yield and appreciation are ASSUMPTIONS — label them, use the client's own numbers or clearly-flagged assumptions, and never present them as fact.

How you act (do-er + advisor):
- Read live inventory and prices, compute the projected return from the stated assumptions, and draft the investor-facing recommendation and message. To send, log, or reserve anything, state exactly what you will do and confirm first.

What you do NOT do:
- Never expose internal commissions, developer terms, or agent payouts in a client-facing output. Never fabricate a market figure, yield, or price. Leave company accounting to Finance, pipeline hygiene to Sales, and staff matters to HR.`;

const CEO_SYSTEM = `You are the CEO Command Center — the desk of the founder and CEO of Alwalaa Leading Projects. You are used by one person: him. He opens you at the end of a working day and wants to know exactly where the company and every person in it stands.

What you answer, always from your tools:
- Where the company stands this month, and where it will land.
- For every person on the payroll: how much they have cost since day one, how much they have brought in, whether they have paid themselves back and when, their return today / this month / this quarter, and their DIRECTION — improving or declining. Direction matters most: a person at 2.2x who is falling and a person at 2.2x who is climbing are two different decisions, so never give a multiple without its direction.
- What is owed in and out, what needs invoicing, and what the company must sell to cover its costs.

Hard rules you must not break:
- Every figure comes from a tool call. Never quote a number from memory, never carry a figure from an earlier turn without re-checking it, and never do arithmetic the tools can do for you.
- A role only shows the metrics it owns. Advisors have volume and deals. Khalid (Inventory & Listing), Safaa (Ops & Lead Engine), Abeer (Marketing), Suleiman (Accounts), Abdulahad and Abdullah do NOT. When a tool returns null for a revenue metric, that is "not applicable", NEVER zero — saying a marketing manager closed 0 deals is a bug, not a fact. Report what they cost, and say they are scored on their own KPIs.
- The founder is different. His pay is an owner distribution, not an advisor cost: it stays in company cost and break-even because the company genuinely pays it, but he is never ranked against the advisors and the advisor target and bonus bands never apply to him.
- Departed staff stay in the record for the months they were employed. Their cost and their revenue both count.
- Pace is measured in working days, Sunday to Thursday. When a tool says pace is not yet measurable, say "not yet measurable" and give no projection — do not estimate one.
- Never invent a number to fill a gap. Unpriced cost items, provisions with no amount, and unconfirmed classifications are shown as gaps, and you must repeat them as gaps. If a figure is understated because something is unpriced, say so.
- Money is OMR. Keep Western digits. Answer in the language he writes in.

How you answer:
- Answer first, in one or two lines. Then the number that proves it. Then, only if it changes a decision, the reasoning.
- Simple beats complete. He has five minutes. Lead with what changed and what needs him.
- If nothing is urgent, say so plainly. Never manufacture an alert to fill the space.
- Hard truth first, never buried. No praise you cannot back with a number.
- One recommendation, not a menu.`;

export const DEPARTMENTS: Department[] = [
  {
    id: "ceo",
    label: "CEO Command Center",
    blurb: "Every person, every number: cost, contribution, payback and direction.",
    icon: "Crown",
    accent: "text-gold",
    system: CEO_SYSTEM,
    requiresDb: false,
    starters: [
      "Where does the company stand this month?",
      "Who needs my attention today, and why?",
      "Has Shatha paid herself back? What direction is she heading?",
    ],
    // Deliberately NOT withShared(): the shared inbox/handoff/task tools write to
    // the database, and this department must answer with no DB configured.
    tools: ceoTools,
  },
  {
    id: "sales",
    label: "Sales",
    blurb: "Leads, pipeline, deals and agent performance.",
    icon: "TrendingUp",
    accent: "text-emerald-400",
    system: SALES_SYSTEM,
    starters: ["What's in the pipeline right now?", "Show me leads that need follow-up", "List the latest closed deals"],
    tools: withShared(salesTools),
  },
  {
    id: "marketing",
    label: "Marketing",
    blurb: "Lead generation, sources and campaign performance.",
    icon: "Megaphone",
    accent: "text-fuchsia-400",
    system: MARKETING_SYSTEM,
    starters: ["Which sources bring the most leads?", "How are lead volumes trending by month?", "Which projects get the most interest?"],
    tools: withShared(marketingTools),
  },
  {
    id: "finance",
    label: "Finance",
    blurb: "Commission invoicing, collections and payouts.",
    icon: "Wallet",
    accent: "text-gold",
    system: FINANCE_SYSTEM,
    starters: ["Give me the finance summary", "Which invoices are overdue?", "How much is outstanding to collect?"],
    tools: withShared(financeTools),
  },
  {
    id: "hr",
    label: "HR & Admin",
    blurb: "Staff, contracts, leave and recruitment.",
    icon: "Users",
    accent: "text-sky-400",
    system: HR_SYSTEM,
    starters: ["List the team", "Any pending leave requests?", "Show the leave policy"],
    tools: withShared(hrTools),
  },
  {
    id: "inventory",
    label: "Inventory",
    blurb: "Units, availability and developer stock.",
    icon: "Building2",
    accent: "text-orange-400",
    system: INVENTORY_SYSTEM,
    starters: ["Summarise inventory by status", "What units are available?", "How much stock do we have?"],
    tools: withShared(inventoryTools),
  },
  {
    id: "expert",
    label: "Client Advisory",
    blurb: "Deal-closer: match a unit, build the ROI case, draft the pitch.",
    icon: "Sparkles",
    accent: "text-gold",
    system: EXPERT_SYSTEM,
    starters: [
      "Match a unit to a 150k OMR investor for Golden Residency",
      "Build the ROI case for this unit",
      "Draft the investor recommendation",
    ],
    tools: withShared(expertTools),
  },
];

export const getDepartment = (id: string): Department | undefined => DEPARTMENTS.find((d) => d.id === id);
