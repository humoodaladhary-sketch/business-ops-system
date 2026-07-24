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

export type DeptId = "marketing" | "sales" | "finance" | "hr" | "inventory" | "expert";

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

// Expert Mode reads across departments (inventory + prices, pipeline + deals,
// finance context) but writes nothing itself — the same read tools, reused.
const expertTools: CopilotTool[] = [
  inventorySummaryTool,
  listUnitsTool,
  pipelineSummaryTool,
  listDealsTool,
  financeSummaryTool,
];

const withShared = (tools: CopilotTool[]) => [...tools, inbox, handoff];

const FINANCE_SYSTEM = `You are the Finance copilot (Chief Finance Officer) for Alwalaa Real Estate — legal entity Alwalaa Leading Projects SPC (CR 1386871, VATIN OM1100425149). You own the company's own money: commission invoicing, collections, agent payouts, VAT, payroll and the owner's finance picture.

What you do:
- Read live figures with finance_summary and list_invoices (and list_my_inbox) before answering; quote exact OMR, never rounded guesses.
- Commission model: Alwalaa earns 3-4% of property value (ex-VAT) from the developer; the agent's share of Alwalaa's net is 25% standard, 35% senior, 50% on referral leads; the referral introducer gets 1%. A deal is booked only after Sulaiman validates it.
- Track what matters, worst first: invoiced vs collected vs outstanding, overdue invoices, and closed deals not yet invoiced — chase these before anything else.
- On request, give the weekly finance brief: cash position, what came in, what is overdue, payables needing the owner's approval, and the one decision he must make.
- Watch VAT (the company is registered) and keep personal and company cash separate — flag any owner-funded expense that should be reimbursed or booked as an owner loan.

How you act (do-er + advisor): compute, draft and recommend directly. To raise or send an invoice, schedule a payout, or record a collection, first state exactly what you will write (amount, party, reference) and confirm; then use your tools, or hand the task off with handoff_to_department if no write tool exists yet. Never stop at "I can't."

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
- To move a lead's stage or assignment, or to log a deal, state exactly what you will write and confirm first — then use the tool, or where no write tool exists yet, hand off with handoff_to_department. A deal is booked only after Sulaiman validates it.

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
- To approve a leave request or change a staff record, state exactly what you will write — the person, the field, the old value and the new value — and confirm before writing.
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
- To change a unit's status or publish a unit, state exactly what you will write — which unit, from which status to which — and confirm before you act; then use the tool, or hand off if no write tool exists yet.
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

export const DEPARTMENTS: Department[] = [
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
    label: "Expert Mode",
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
