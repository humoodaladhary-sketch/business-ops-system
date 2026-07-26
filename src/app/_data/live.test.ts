// The live Supabase → DataBundle mapping layer. These mappers are the truth
// boundary between the DB rows and every dashboard number, so each rule that
// affects money or accountability gets pinned here.
import { describe, expect, it } from "vitest";
import { mapDeal, mapLead, mapStaff, type DealRow, type LeadRow, type ProjectRow, type StaffRow } from "./live";
import { dashboardPeriod, DEMO_PERIOD } from "./demo";
import type { DataBundle } from "./source";
import type { DealRecord } from "./dataset";

const NOW = new Date("2026-07-25T12:00:00Z");

const staffRow = (over: Partial<StaffRow> = {}): StaffRow => ({
  id: "u1",
  role: "advisor",
  status: "active",
  segment: "resident",
  monthly_target_omr: "250000.000",
  ramp_end_date: null,
  exempt_from_at_risk: false,
  drive_folder_url: null,
  closed_docs_url: null,
  vouchers_url: null,
  ...over,
});

describe("mapStaff", () => {
  it("maps an advisor with a numeric-string target", () => {
    const a = mapStaff({ id: "u1", full_name: "Alex Showran" }, staffRow(), NOW);
    expect(a).toMatchObject({ id: "u1", name: "Alex Showran", role: "ADVISOR", segment: "RESIDENT", target: 250000, status: "ACTIVE" });
  });

  it("marks an advisor still inside the ramp window as NEW", () => {
    const a = mapStaff({ id: "u1", full_name: "Khalid" }, staffRow({ ramp_end_date: "2026-09-01" }), NOW);
    expect(a?.role).toBe("NEW");
    expect(a?.rampEndDate).toBe("2026-09-01");
  });

  it("keeps senior/former mapping and excludes non-sales staff", () => {
    const senior = mapStaff({ id: "u2", full_name: "Shatha" }, staffRow({ role: "senior_advisor", status: "former" }), NOW);
    expect(senior).toMatchObject({ role: "SENIOR", status: "FORMER" });
    expect(mapStaff({ id: "u3", full_name: "Ops" }, staffRow({ role: "operations_manager" }), NOW)).toBeNull();
  });
});

const dealRow = (over: Partial<DealRow> = {}): DealRow => ({
  id: "d1",
  agent_id: "u1",
  client_name: "Mohammad Edris Karim",
  project_id: "p1",
  value_omr: "43500.000",
  developer_pct: "0.0350",
  gross_omr: "1522.500",
  split_pct: "0.3500",
  payout_omr: "532.880",
  source: "ALWALAA",
  developer: "Ahly Sabbour",
  project_name: "Wadi Zaha",
  unit_type: "Studio",
  unit_number: "E26-D512",
  pv_reference: "PV-2026-0003",
  developer_paid: true,
  agent_paid: true,
  is_reservation: false,
  closed_at: "2025-10-30T00:00:00+00:00",
  created_at: "2025-10-30T00:00:00+00:00",
  external_id: "drive:sh1",
  ...over,
});

const projects = new Map<string, ProjectRow>([["p1", { id: "p1", name: "Wadi Zaha (catalog)", developer: "Ahly Sabbour (catalog)" }]]);

describe("mapDeal", () => {
  it("maps money as numbers, rates to percent, and paid flags to statuses", () => {
    const d = mapDeal(dealRow(), projects);
    expect(d).toMatchObject({
      value: 43500,
      devRatePct: 3.5,
      gross: 1522.5,
      splitPct: 35,
      payout: 532.88,
      devPaid: "RECEIVED",
      agentPaid: "PAID",
      stage: "CLOSED_WON",
      closeDate: "2025-10-30",
      period: "2025-10",
      pv: "PV-2026-0003",
    });
  });

  it("prefers denormalized labels but falls back to the project catalog", () => {
    const d = mapDeal(dealRow({ developer: null, project_name: null }), projects);
    expect(d.developer).toBe("Ahly Sabbour (catalog)");
    expect(d.project).toBe("Wadi Zaha (catalog)");
  });

  it("treats a reservation without closed_at as its created month", () => {
    const d = mapDeal(
      dealRow({ is_reservation: true, closed_at: null, created_at: "2026-05-15T00:00:00+00:00" }),
      projects,
    );
    expect(d.stage).toBe("RESERVATION");
    expect(d.closeDate).toBeNull();
    expect(d.period).toBe("2026-05");
  });

  it("computes gross from value × rate when the recorded gross is missing, and defaults unknown sources to ALWALAA", () => {
    const d = mapDeal(dealRow({ gross_omr: null, source: "mystery" }), projects);
    expect(d.gross).toBeCloseTo(43500 * 0.035, 6);
    expect(d.source).toBe("ALWALAA");
  });
});

const leadRow = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: "l1",
  assigned_agent_id: "u1",
  title: "Mr.",
  name: "Jilal Malih",
  phone_e164: "+447958008313",
  email: null,
  country: "United Kingdom",
  nationality: "British",
  budget_band: "75,000 – 100,000 OMR",
  purpose: "Investment - Rental Income",
  project_interest: "Wadi Zaha",
  source: "ALWALAA",
  raw_stage: "Qualification meeting",
  stage: "engaged",
  deal_status: "In Progress",
  registered_on: "2026-02-20",
  last_touch_at: "2026-03-02T09:00:00+00:00",
  created_at: "2026-02-20T00:00:00+00:00",
  notes: null,
  external_id: "drive:ld1",
  ...over,
});

describe("mapLead", () => {
  it("uppercases the stage enum into the canonical pipeline and keeps dates as days", () => {
    const l = mapLead(leadRow());
    expect(l).toMatchObject({ stage: "ENGAGED", registeredOn: "2026-02-20", lastFollowUp: "2026-03-02", source: "ALWALAA" });
  });

  it("maps agent-network sources to OWN and falls back to created_at for registration", () => {
    const l = mapLead(leadRow({ source: "AGENT_NETWORK", registered_on: null }));
    expect(l.source).toBe("OWN");
    expect(l.registeredOn).toBe("2026-02-20");
  });
});

describe("dashboardPeriod", () => {
  const deal = (period: string, stage: DealRecord["stage"] = "CLOSED_WON"): DealRecord =>
    ({ period, stage } as DealRecord);
  const bundle = (live: boolean, deals: DealRecord[]): DataBundle =>
    ({ live, deals, agents: [], leads: [] }) as DataBundle;

  it("pins the curated period for the snapshot", () => {
    expect(dashboardPeriod(bundle(false, [deal("2026-07")]), NOW)).toBe(DEMO_PERIOD);
  });

  it("scores the latest month with a closed deal when live", () => {
    expect(dashboardPeriod(bundle(true, [deal("2026-05"), deal("2026-07", "RESERVATION"), deal("2026-03")]), NOW)).toBe("2026-05");
  });

  it("falls back to the current month before the first live close", () => {
    expect(dashboardPeriod(bundle(true, []), NOW)).toBe("2026-07");
  });
});
