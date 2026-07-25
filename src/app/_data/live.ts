// Live Supabase data source for the dashboards. Reads the same tables the
// department copilots and the Zoho/Drive syncs use, and maps them into the
// DataBundle shape the (pure) compute layer already consumes.
//
// Truth rule: only rows carrying an external_id (Zoho sync, Drive CRM seed)
// count as business data. Hand-inserted demo rows have no external_id and
// must never surface on an owner-facing screen.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "../_departments/config";
import type { AgentRecord, DealRecord, LeadRecord, SourceTag } from "./dataset";
import type { DataBundle } from "./source";

// Row shapes (the subset of columns we select).
export interface ProfileRow {
  id: string;
  full_name: string | null;
}
export interface StaffRow {
  id: string;
  role: string;
  status: string;
  segment: string | null;
  monthly_target_omr: number | string | null;
  ramp_end_date: string | null;
  exempt_from_at_risk: boolean;
  drive_folder_url: string | null;
  closed_docs_url: string | null;
  vouchers_url: string | null;
}
export interface DealRow {
  id: string;
  agent_id: string;
  client_name: string | null;
  project_id: string | null;
  value_omr: number | string;
  developer_pct: number | string | null;
  gross_omr: number | string | null;
  split_pct: number | string | null;
  payout_omr: number | string | null;
  source: string | null;
  developer: string | null;
  project_name: string | null;
  unit_type: string | null;
  unit_number: string | null;
  pv_reference: string | null;
  developer_paid: boolean;
  agent_paid: boolean;
  is_reservation: boolean;
  closed_at: string | null;
  created_at: string | null;
  external_id: string | null;
}
export interface LeadRow {
  id: string;
  assigned_agent_id: string | null;
  title: string | null;
  name: string;
  phone_e164: string | null;
  email: string | null;
  country: string | null;
  nationality: string | null;
  budget_band: string | null;
  purpose: string | null;
  project_interest: string | null;
  source: string | null;
  raw_stage: string | null;
  stage: string;
  deal_status: string | null;
  registered_on: string | null;
  last_touch_at: string | null;
  created_at: string | null;
  notes: string | null;
  external_id: string | null;
}
export interface ProjectRow {
  id: string;
  name: string;
  developer: string | null;
}

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));
const day = (ts: string | null | undefined): string | null => (ts ? ts.slice(0, 10) : null);
// Rates are stored as numeric(6,4) fractions; ×100 introduces float noise
// (0.035 → 3.5000000000000004), so percent values are rounded for display.
const pct = (fraction: number | string | null | undefined): number => Math.round(num(fraction) * 1e6) / 1e4;

// staff_role enum -> dashboard role. HR/Ops staff are not sales dashboard rows.
const ROLE_MAP: Record<string, AgentRecord["role"] | undefined> = {
  ceo: "CEO",
  finance_head: "FINANCE",
  marketing_manager: "MARKETING",
  sales_manager: "HEAD_OF_SALES",
  team_leader: "SENIOR",
  senior_advisor: "SENIOR",
  advisor: "ADVISOR",
};

export function mapStaff(profile: ProfileRow, staff: StaffRow, now = new Date()): AgentRecord | null {
  const mapped = ROLE_MAP[staff.role];
  if (!mapped) return null;
  const inRamp = staff.ramp_end_date ? new Date(staff.ramp_end_date).getTime() > now.getTime() : false;
  const role = mapped === "ADVISOR" && inRamp ? "NEW" : mapped;
  const segment = (staff.segment ?? "na").toUpperCase();
  return {
    id: profile.id,
    name: profile.full_name ?? "—",
    role,
    segment: (segment === "DIASPORA" || segment === "RESIDENT" ? segment : "NA") as AgentRecord["segment"],
    target: num(staff.monthly_target_omr),
    rampEndDate: staff.ramp_end_date ?? undefined,
    exempt: staff.exempt_from_at_risk,
    status: staff.status === "former" ? "FORMER" : "ACTIVE",
    driveFolder: staff.drive_folder_url ?? undefined,
    closedDocs: staff.closed_docs_url ?? undefined,
    vouchers: staff.vouchers_url ?? undefined,
  };
}

const SOURCES: SourceTag[] = ["ALWALAA", "REFERRAL", "OWN"];

export function mapDeal(row: DealRow, projectById: Map<string, ProjectRow>): DealRecord {
  const project = row.project_id ? projectById.get(row.project_id) : undefined;
  const value = num(row.value_omr);
  const devRate = num(row.developer_pct);
  const anchor = row.closed_at ?? row.created_at ?? "";
  return {
    id: row.id,
    agentId: row.agent_id,
    client: row.client_name ?? "—",
    developer: row.developer ?? project?.developer ?? "—",
    project: row.project_name ?? project?.name ?? "—",
    unitType: row.unit_type ?? "",
    unitNumber: row.unit_number ?? "",
    value,
    devRatePct: pct(row.developer_pct),
    gross: row.gross_omr != null ? num(row.gross_omr) : value * devRate,
    splitPct: pct(row.split_pct),
    payout: num(row.payout_omr),
    source: SOURCES.includes(row.source as SourceTag) ? (row.source as SourceTag) : "ALWALAA",
    devPaid: row.developer_paid ? "RECEIVED" : "NOT_RECEIVED",
    agentPaid: row.agent_paid ? "PAID" : "NOT_PAID",
    closeDate: day(row.closed_at),
    period: anchor.slice(0, 7),
    stage: row.is_reservation ? "RESERVATION" : "CLOSED_WON",
    pv: row.pv_reference ?? undefined,
  };
}

export function mapLead(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    agentId: row.assigned_agent_id,
    title: row.title ?? "",
    name: row.name,
    phoneRaw: row.phone_e164 ?? "",
    email: row.email,
    country: row.country,
    nationality: row.nationality,
    language: null,
    budget: row.budget_band,
    purpose: row.purpose,
    projectInterest: row.project_interest,
    source: row.source === "AGENT_NETWORK" || row.source === "OWN" ? "OWN" : row.source === "REFERRAL" ? "REFERRAL" : "ALWALAA",
    rawStage: row.raw_stage ?? "",
    stage: row.stage.toUpperCase(),
    dealStatus: row.deal_status,
    registeredOn: row.registered_on ?? day(row.created_at),
    lastFollowUp: day(row.last_touch_at),
    notes: row.notes,
  };
}

/**
 * Load the dashboard bundle from Supabase. Returns null when the service key
 * is absent, a query fails, or no externally-sourced CRM rows exist yet — the
 * caller then falls back (Prisma, then the baked snapshot).
 */
export async function loadLiveBundle(): Promise<DataBundle | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const [profiles, staff, deals, leads, projects] = await Promise.all([
    db.from("profiles").select("id,full_name").eq("organization_id", ORG_ID),
    db
      .from("staff_profiles")
      .select(
        "id,role,status,segment,monthly_target_omr,ramp_end_date,exempt_from_at_risk,drive_folder_url,closed_docs_url,vouchers_url",
      )
      .eq("organization_id", ORG_ID),
    db
      .from("deals")
      .select(
        "id,agent_id,client_name,project_id,value_omr,developer_pct,gross_omr,split_pct,payout_omr,source,developer,project_name,unit_type,unit_number,pv_reference,developer_paid,agent_paid,is_reservation,closed_at,created_at,external_id",
      )
      .eq("organization_id", ORG_ID)
      .not("external_id", "is", null),
    db
      .from("leads")
      .select(
        "id,assigned_agent_id,title,name,phone_e164,email,country,nationality,budget_band,purpose,project_interest,source,raw_stage,stage,deal_status,registered_on,last_touch_at,created_at,notes,external_id",
      )
      .eq("organization_id", ORG_ID)
      .not("external_id", "is", null),
    db.from("projects").select("id,name,developer").eq("organization_id", ORG_ID),
  ]);

  if (profiles.error || staff.error || deals.error || leads.error || projects.error) return null;

  const dealRows = (deals.data ?? []) as DealRow[];
  const leadRows = (leads.data ?? []) as LeadRow[];
  // Nothing synced/seeded yet — the snapshot is more truthful than an empty screen.
  if (dealRows.length === 0 && leadRows.length === 0) return null;

  const profileById = new Map((profiles.data as ProfileRow[]).map((p) => [p.id, p]));
  const agents = ((staff.data ?? []) as StaffRow[])
    .map((s) => {
      const p = profileById.get(s.id);
      return p ? mapStaff(p, s) : null;
    })
    .filter((a): a is AgentRecord => a !== null);

  const projectById = new Map(((projects.data ?? []) as ProjectRow[]).map((p) => [p.id, p]));

  return {
    agents,
    deals: dealRows.map((d) => mapDeal(d, projectById)),
    leads: leadRows.map(mapLead),
    live: true,
  };
}

// ---------------------------------------------------------------------------
// Finance (Zoho Books sync) — mirrors the Finance copilot's finance_summary
// tool so the owner sees the same numbers in chat and on the dashboards.
// ---------------------------------------------------------------------------

export interface FinanceSummary {
  invoicedOMR: number;
  collectedOMR: number;
  outstandingOMR: number;
  invoiceCount: number;
  overdueCount: number;
  overdueOMR: number;
}

export async function loadFinanceSummary(): Promise<FinanceSummary | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const [inv, col] = await Promise.all([
    db.from("invoices").select("amount_omr,status").eq("organization_id", ORG_ID),
    db.from("collections").select("amount_omr").eq("organization_id", ORG_ID),
  ]);
  if (inv.error || col.error || !inv.data || inv.data.length === 0) return null;
  const invoices = inv.data as { amount_omr: number | string; status: string }[];
  const invoiced = invoices.reduce((s, r) => s + num(r.amount_omr), 0);
  const collected = ((col.data ?? []) as { amount_omr: number | string }[]).reduce(
    (s, r) => s + num(r.amount_omr),
    0,
  );
  const overdue = invoices.filter((r) => r.status === "overdue");
  return {
    invoicedOMR: invoiced,
    collectedOMR: collected,
    outstandingOMR: invoiced - collected,
    invoiceCount: invoices.length,
    overdueCount: overdue.length,
    overdueOMR: overdue.reduce((s, r) => s + num(r.amount_omr), 0),
  };
}
