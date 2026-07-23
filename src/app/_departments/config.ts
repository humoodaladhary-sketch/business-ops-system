import type { SupabaseClient } from "@supabase/supabase-js";

// The single organization (owner-only mode).
export const ORG_ID = "6a32be59-155d-4662-9058-3a74fb2b6872";

export type ToolInput = Record<string, unknown>;

export interface CopilotTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (db: SupabaseClient, input: ToolInput, deptId: string) => Promise<unknown>;
}

export interface Department {
  id: DeptId;
  label: string;
  blurb: string;
  icon: string; // lucide-react name
  accent: string; // tailwind text color
  system: string;
  starters: string[];
  tools: CopilotTool[];
}

export type DeptId = "marketing" | "sales" | "finance" | "hr" | "inventory";

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
const salesTools: CopilotTool[] = [
  {
    name: "pipeline_summary",
    description: "Count of leads in each pipeline stage.",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db.from("leads").select("stage").eq("organization_id", ORG_ID);
      return error ? { error: error.message } : { total: data.length, by_stage: groupCount(data, "stage") };
    },
  },
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
  {
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
  },
];

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
];

const financeTools: CopilotTool[] = [
  {
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
  },
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

const inventoryTools: CopilotTool[] = [
  {
    name: "inventory_summary",
    description: "Count of units by status (available, reserved, sold).",
    input_schema: { type: "object", properties: {} },
    run: async (db) => {
      const { data, error } = await db.from("units").select("status").eq("organization_id", ORG_ID);
      return error ? { error: error.message } : { total: data.length, by_status: groupCount(data, "status") };
    },
  },
  {
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
  },
];

const withShared = (tools: CopilotTool[]) => [...tools, inbox, handoff];
const base = (role: string, mission: string) =>
  `You are the ${role} copilot for Alwalaa Real Estate — a luxury brokerage in Muscat, Oman selling ITC freehold property to foreign investors (Golden/Investor Residency, ROI). ${mission} Read live data with your tools before quoting any number; never invent figures. Be concise and specific, use OMR for money. When a request belongs to another team, use handoff_to_department. Check list_my_inbox when asked what's pending.`;

export const DEPARTMENTS: Department[] = [
  {
    id: "sales",
    label: "Sales",
    blurb: "Leads, pipeline, deals and agent performance.",
    icon: "TrendingUp",
    accent: "text-emerald-400",
    system: base("Sales", "You own the lead pipeline and closing deals."),
    starters: ["What's in the pipeline right now?", "Show me leads that need follow-up", "List the latest closed deals"],
    tools: withShared(salesTools),
  },
  {
    id: "marketing",
    label: "Marketing",
    blurb: "Lead generation, sources and campaign performance.",
    icon: "Megaphone",
    accent: "text-fuchsia-400",
    system: base("Marketing", "You own bringing in leads and knowing which channels perform."),
    starters: ["Which sources bring the most leads?", "How are lead volumes trending by month?", "Which projects get the most interest?"],
    tools: withShared(marketingTools),
  },
  {
    id: "finance",
    label: "Finance",
    blurb: "Commission invoicing, collections and payouts.",
    icon: "Wallet",
    accent: "text-gold",
    system: base("Finance", "You own commission invoicing, collecting on time, and agent payouts."),
    starters: ["Give me the finance summary", "Which invoices are overdue?", "How much is outstanding to collect?"],
    tools: withShared(financeTools),
  },
  {
    id: "hr",
    label: "HR & Admin",
    blurb: "Staff, contracts, leave and recruitment.",
    icon: "Users",
    accent: "text-sky-400",
    system: base("HR & Admin", "You own people: staff records, Oman-labour leave, attendance and hiring."),
    starters: ["List the team", "Any pending leave requests?", "Show the leave policy"],
    tools: withShared(hrTools),
  },
  {
    id: "inventory",
    label: "Inventory",
    blurb: "Units, availability and developer stock.",
    icon: "Building2",
    accent: "text-orange-400",
    system: base("Inventory", "You own the property inventory: units, availability and developer stock."),
    starters: ["Summarise inventory by status", "What units are available?", "How much stock do we have?"],
    tools: withShared(inventoryTools),
  },
];

export const getDepartment = (id: string): Department | undefined => DEPARTMENTS.find((d) => d.id === id);
