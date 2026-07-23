// Department API — powers the department pages and copilots with ZERO app-side
// config. Runs inside Supabase so SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are
// injected automatically. Token-gated (x-sync-token).
//   POST { action: "data",  department }            -> live snapshot for the dept page
//   POST { action: "chat",  department, messages }  -> AI copilot (needs ANTHROPIC_API_KEY secret)
//   POST { action: "handoff_inbox" }                -> all open cross-dept tasks
import { createClient } from "npm:@supabase/supabase-js@2";

const ORG = "6a32be59-155d-4662-9058-3a74fb2b6872";
const TOKEN = "6e9342e74d7a4eb39720441a504ef6f33ba2c091638d3c85";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-sonnet-latest";
const cors = { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,x-sync-token" };

// deno-lint-ignore no-explicit-any
type DB = any;
const sum = (rows: Record<string, unknown>[], k: string) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
const group = (rows: Record<string, unknown>[], k: string) => {
  const o: Record<string, number> = {};
  for (const r of rows) { const v = (r[k] as string) ?? "unknown"; o[v] = (o[v] ?? 0) + 1; }
  return o;
};

async function snapshot(db: DB, dept: string) {
  const q = (t: string, c: string) => db.from(t).select(c).eq("organization_id", ORG);
  if (dept === "finance") {
    const [inv, col] = await Promise.all([q("invoices", "reference,developer,amount_omr,status,due_date"), q("collections", "amount_omr")]);
    const rows = inv.data ?? [];
    const invoiced = sum(rows, "amount_omr");
    const collected = sum(col.data ?? [], "amount_omr");
    return {
      kpis: [
        { label: "Invoiced", value: invoiced, money: true },
        { label: "Collected", value: collected, money: true },
        { label: "Outstanding", value: invoiced - collected, money: true },
        { label: "Overdue", value: rows.filter((r: Record<string, unknown>) => r.status === "overdue").length },
      ],
      table: { title: "Invoices", columns: ["reference", "developer", "amount_omr", "status", "due_date"], rows: rows.slice(0, 12) },
    };
  }
  if (dept === "sales") {
    const [leads, deals] = await Promise.all([q("leads", "name,country,stage,source,last_touch_at"), q("deals", "client_name,value_omr,payout_omr,closed_at")]);
    const lr = leads.data ?? [], dr = deals.data ?? [];
    return {
      kpis: [
        { label: "Leads", value: lr.length },
        { label: "Deals closed", value: dr.length },
        { label: "Deal value", value: sum(dr, "value_omr"), money: true },
        { label: "In negotiation", value: lr.filter((r: Record<string, unknown>) => ["negotiation", "reservation"].includes(r.stage as string)).length },
      ],
      chips: group(lr, "stage"),
      table: { title: "Recent leads", columns: ["name", "country", "stage", "source"], rows: lr.slice(0, 12) },
    };
  }
  if (dept === "marketing") {
    const leads = await q("leads", "source,created_at,name,country");
    const lr = leads.data ?? [];
    const byMonth: Record<string, number> = {};
    for (const r of lr) { const m = String(r.created_at ?? "").slice(0, 7); if (m) byMonth[m] = (byMonth[m] ?? 0) + 1; }
    return {
      kpis: [{ label: "Total leads", value: lr.length }, { label: "Sources", value: Object.keys(group(lr, "source")).length }],
      chips: group(lr, "source"),
      table: { title: "Leads by month", columns: ["month", "leads"], rows: Object.entries(byMonth).map(([month, leads]) => ({ month, leads })) },
    };
  }
  if (dept === "hr") {
    const [staff, leaves, cands] = await Promise.all([
      db.from("staff_profiles").select("role,status,profiles(full_name)").eq("organization_id", ORG),
      q("leave_requests", "staff_id,start_date,end_date,reason,status").eq("status", "pending"),
      q("candidates", "name,stage"),
    ]);
    const sr = staff.data ?? [];
    return {
      kpis: [
        { label: "Team", value: sr.length },
        { label: "Pending leave", value: (leaves.data ?? []).length },
        { label: "Candidates", value: (cands.data ?? []).length },
      ],
      chips: group(sr, "role"),
      table: { title: "Team", columns: ["full_name", "role", "status"], rows: sr.map((r: Record<string, unknown>) => ({ full_name: (r.profiles as { full_name?: string })?.full_name ?? "—", role: r.role, status: r.status })).slice(0, 12) },
    };
  }
  if (dept === "inventory") {
    const units = await q("units", "reference_id,unit_type,bedrooms,price_omr,status,projects(name)");
    const ur = units.data ?? [];
    return {
      kpis: [
        { label: "Units", value: ur.length },
        { label: "Available", value: ur.filter((r: Record<string, unknown>) => r.status === "available").length },
        { label: "Stock value", value: sum(ur, "price_omr"), money: true },
      ],
      chips: group(ur, "status"),
      table: { title: "Units", columns: ["reference_id", "unit_type", "bedrooms", "price_omr", "status"], rows: ur.slice(0, 12) },
    };
  }
  return { kpis: [], table: null };
}

// ---- Copilot tools (chat action) -------------------------------------------
interface Tool { name: string; description: string; input_schema: unknown; run: (db: DB, i: Record<string, unknown>) => Promise<unknown>; }
const t = (name: string, description: string, props: Record<string, unknown>, run: Tool["run"]): Tool => ({ name, description, input_schema: { type: "object", properties: props }, run });
const handoff = t("handoff_to_department", "Send a task to another department (marketing, sales, finance, hr, inventory).",
  { to_department: { type: "string" }, title: { type: "string" }, detail: { type: "string" }, priority: { type: "string" } },
  async (db, i) => (await db.from("department_tasks").insert({ organization_id: ORG, from_department: (i.__dept as string) ?? "system", to_department: i.to_department, title: i.title, detail: i.detail ?? null, priority: i.priority ?? "normal" }).select("id,title,to_department").single()).data);

const TOOLS: Record<string, Tool[]> = {
  sales: [
    t("pipeline_summary", "Leads count per stage.", {}, async (db) => group((await db.from("leads").select("stage").eq("organization_id", ORG)).data ?? [], "stage")),
    t("list_leads", "List leads, optional stage filter.", { stage: { type: "string" } }, async (db, i) => (await (i.stage ? db.from("leads").select("name,country,budget_max_omr,stage,source").eq("organization_id", ORG).eq("stage", i.stage) : db.from("leads").select("name,country,budget_max_omr,stage,source").eq("organization_id", ORG)).limit(40)).data),
    t("list_deals", "Closed deals with value and payout.", {}, async (db) => (await db.from("deals").select("client_name,value_omr,payout_omr,closed_at").eq("organization_id", ORG).limit(40)).data),
    handoff,
  ],
  marketing: [
    t("lead_source_breakdown", "Leads grouped by source.", {}, async (db) => group((await db.from("leads").select("source").eq("organization_id", ORG)).data ?? [], "source")),
    t("list_leads", "List leads with source and interest.", {}, async (db) => (await db.from("leads").select("name,country,source,stage,projects(name)").eq("organization_id", ORG).limit(40)).data),
    handoff,
  ],
  finance: [
    t("finance_summary", "Invoiced, collected, outstanding, overdue.", {}, async (db) => {
      const inv = (await db.from("invoices").select("amount_omr,status").eq("organization_id", ORG)).data ?? [];
      const col = (await db.from("collections").select("amount_omr").eq("organization_id", ORG)).data ?? [];
      const invoiced = sum(inv, "amount_omr"), collected = sum(col, "amount_omr");
      return { invoiced_omr: invoiced, collected_omr: collected, outstanding_omr: invoiced - collected, invoice_count: inv.length, overdue_count: inv.filter((r: Record<string, unknown>) => r.status === "overdue").length };
    }),
    t("list_invoices", "List invoices, optional status filter.", { status: { type: "string" } }, async (db, i) => (await (i.status ? db.from("invoices").select("reference,developer,amount_omr,status,due_date").eq("organization_id", ORG).eq("status", i.status) : db.from("invoices").select("reference,developer,amount_omr,status,due_date").eq("organization_id", ORG)).order("due_date").limit(50)).data),
    handoff,
  ],
  hr: [
    t("list_staff", "Team with role and status.", {}, async (db) => (await db.from("staff_profiles").select("role,status,monthly_target_omr,profiles(full_name)").eq("organization_id", ORG)).data),
    t("pending_leave_requests", "Leave awaiting approval.", {}, async (db) => (await db.from("leave_requests").select("staff_id,start_date,end_date,reason").eq("organization_id", ORG).eq("status", "pending")).data),
    t("leave_catalog", "Oman leave types and allowances.", {}, async (db) => (await db.from("leave_types").select("code,name_en,paid,default_days_per_year").eq("organization_id", ORG)).data),
    handoff,
  ],
  inventory: [
    t("inventory_summary", "Units by status.", {}, async (db) => group((await db.from("units").select("status").eq("organization_id", ORG)).data ?? [], "status")),
    t("list_units", "List units, optional status filter.", { status: { type: "string" } }, async (db, i) => (await (i.status ? db.from("units").select("reference_id,unit_type,bedrooms,price_omr,status,projects(name)").eq("organization_id", ORG).eq("status", i.status) : db.from("units").select("reference_id,unit_type,bedrooms,price_omr,status,projects(name)").eq("organization_id", ORG)).limit(40)).data),
    handoff,
  ],
};
const SYSTEM: Record<string, string> = {
  sales: "the Sales copilot — you own the lead pipeline and closing deals",
  marketing: "the Marketing copilot — you own lead generation and channel performance",
  finance: "the Finance copilot — you own commission invoicing, collections and payouts",
  hr: "the HR & Admin copilot — you own staff, Oman-labour leave and hiring",
  inventory: "the Inventory copilot — you own units, availability and developer stock",
};

async function chat(db: DB, dept: string, messages: unknown[]) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return { setup: true };
  const tools = (TOOLS[dept] ?? []).map((x) => ({ name: x.name, description: x.description, input_schema: x.input_schema }));
  const system = `You are ${SYSTEM[dept] ?? "a department copilot"} for Alwalaa Real Estate (luxury Oman ITC freehold property for foreign investors). Read live data with your tools before quoting numbers; never invent figures. Money is OMR. Be concise. To pass work to another team use handoff_to_department. Today is ${new Date().toISOString().slice(0, 10)}.`;
  const convo = [...messages] as { role: string; content: unknown }[];
  for (let step = 0; step < 6; step++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1200, system, tools, messages: convo }),
    });
    if (!res.ok) return { error: "anthropic", status: res.status, detail: (await res.text()).slice(0, 400) };
    const data = await res.json();
    convo.push({ role: "assistant", content: data.content });
    if (data.stop_reason === "tool_use") {
      const results = [];
      for (const b of data.content) {
        if (b.type === "tool_use") {
          const tool = (TOOLS[dept] ?? []).find((x) => x.name === b.name);
          let out: unknown;
          try { out = tool ? await tool.run(db, { ...b.input, __dept: dept }) : { error: "unknown tool" }; } catch (e) { out = { error: String(e) }; }
          results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out).slice(0, 8000) });
        }
      }
      convo.push({ role: "user", content: results });
      continue;
    }
    const text = (data.content as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return { ok: true, reply: text || "(no response)" };
  }
  return { ok: true, reply: "Stopped after several steps — try a narrower question." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.headers.get("x-sync-token") !== TOKEN) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
  let body: { action?: string; department?: string; messages?: unknown[] };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers: cors }); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    if (body.action === "data") return new Response(JSON.stringify(await snapshot(db, body.department ?? "")), { headers: cors });
    if (body.action === "chat") return new Response(JSON.stringify(await chat(db, body.department ?? "", body.messages ?? [])), { headers: cors });
    if (body.action === "handoff_inbox") {
      const { data } = await db.from("department_tasks").select("from_department,to_department,title,detail,priority,status,created_at").eq("organization_id", ORG).neq("status", "done").order("created_at", { ascending: false });
      return new Response(JSON.stringify({ tasks: data }), { headers: cors });
    }
    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
