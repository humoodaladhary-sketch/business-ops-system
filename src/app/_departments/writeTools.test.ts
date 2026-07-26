// Guarded write tools — the safety contract is that NOTHING is written without
// confirm:true, ambiguous matches never write, and lookups always scope to the
// org. The mock below hands each successive db.from() call the next scripted
// result and records every method invoked, so tests can assert both the
// returned shape and that no update/insert was issued.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  completeTaskTool,
  decideLeaveRequestTool,
  moveLeadStageTool,
  recordCollectionTool,
  updateInvoiceStatusTool,
  updateUnitStatusTool,
} from "./config";

type Scripted = { data?: unknown; error?: { message: string } | null };

function mockDb(results: Scripted[]) {
  let call = 0;
  const calls: string[][] = [];
  const from = () => {
    const result = results[call++] ?? { data: null, error: { message: "unexpected extra query" } };
    const invoked: string[] = [];
    calls.push(invoked);
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "ilike", "like", "or", "not", "order", "limit", "single", "update", "insert"]) {
      chain[m] = (...args: unknown[]) => {
        invoked.push(m === "eq" ? `eq(${String(args[0])})` : m);
        return chain;
      };
    }
    (chain as { then: unknown }).then = (onOk: (v: Scripted) => unknown, onErr?: (e: unknown) => unknown) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(onOk, onErr);
    return chain;
  };
  const db = { from } as unknown as SupabaseClient;
  return { db, calls, queries: () => calls.length };
}

const wrote = (calls: string[][]) => calls.some((c) => c.includes("update") || c.includes("insert"));

describe("move_lead_stage", () => {
  const lead = { id: "L1", name: "Jilal Malih", phone_e164: "+447958008313", stage: "engaged" };

  it("rejects an invalid stage without querying", async () => {
    const { db, queries } = mockDb([]);
    const out = (await moveLeadStageTool.run(db, { lead: "Jilal", stage: "won" }, "sales")) as { error: string };
    expect(out.error).toMatch(/invalid stage/);
    expect(queries()).toBe(0);
  });

  it("previews without confirm and writes nothing", async () => {
    const { db, calls } = mockDb([{ data: [] }, { data: [lead] }]); // phone miss → name hit
    const out = (await moveLeadStageTool.run(db, { lead: "Jilal", stage: "viewing" }, "sales")) as Record<string, unknown>;
    expect(out.needs_confirmation).toBe(true);
    expect(out.preview).toMatchObject({ from: "engaged", to: "viewing" });
    expect(wrote(calls)).toBe(false);
  });

  it("returns candidates on an ambiguous match and writes nothing", async () => {
    const { db, calls } = mockDb([{ data: [lead, { ...lead, id: "L2", name: "Jilal Two" }] }]);
    const out = (await moveLeadStageTool.run(db, { lead: "+447958008313", stage: "viewing", confirm: true }, "sales")) as Record<string, unknown>;
    expect(out.ambiguous).toBe(true);
    expect(wrote(calls)).toBe(false);
  });

  it("writes with confirm:true and scopes the lookup to the org", async () => {
    const { db, calls } = mockDb([{ data: [lead] }, { data: { id: "L1", name: "Jilal Malih", stage: "viewing" } }]);
    const out = (await moveLeadStageTool.run(db, { lead: "+447958008313", stage: "viewing", confirm: true }, "sales")) as Record<string, unknown>;
    expect(out.updated).toBe(true);
    expect(calls[0]).toContain("eq(organization_id)");
    expect(calls[1]).toContain("update");
  });

  it("reports unchanged when the lead is already in that stage", async () => {
    const { db, calls } = mockDb([{ data: [lead] }]);
    const out = (await moveLeadStageTool.run(db, { lead: "+447958008313", stage: "engaged", confirm: true }, "sales")) as Record<string, unknown>;
    expect(out.unchanged).toBe(true);
    expect(wrote(calls)).toBe(false);
  });
});

describe("decide_leave_request", () => {
  const pending = { id: "R1", staff_id: "S1", start_date: "2026-08-01", end_date: "2026-08-05", status: "pending" };

  it("refuses to decide a non-pending request", async () => {
    const { db, calls } = mockDb([{ data: { ...pending, status: "approved" } }]);
    const out = (await decideLeaveRequestTool.run(db, { request_id: "R1", decision: "approve", confirm: true }, "hr")) as { error: string };
    expect(out.error).toMatch(/already 'approved'/);
    expect(wrote(calls)).toBe(false);
  });

  it("previews without confirm, then approves with confirm", async () => {
    const preview = mockDb([{ data: pending }]);
    const p = (await decideLeaveRequestTool.run(preview.db, { request_id: "R1", decision: "approve" }, "hr")) as Record<string, unknown>;
    expect(p.needs_confirmation).toBe(true);
    expect(wrote(preview.calls)).toBe(false);

    const write = mockDb([{ data: pending }, { data: { id: "R1", status: "approved" } }]);
    const out = (await decideLeaveRequestTool.run(write.db, { request_id: "R1", decision: "approve", confirm: true }, "hr")) as Record<string, unknown>;
    expect(out.updated).toBe(true);
  });
});

describe("update_invoice_status / record_collection", () => {
  const invoice = { id: "I1", reference: "INV-100", developer: "Sarooj", amount_omr: 2500, status: "sent" };

  it("invoice status: previews without confirm and writes nothing", async () => {
    const { db, calls } = mockDb([{ data: [invoice] }]);
    const out = (await updateInvoiceStatusTool.run(db, { reference: "INV-100", status: "paid" }, "finance")) as Record<string, unknown>;
    expect(out.needs_confirmation).toBe(true);
    expect(wrote(calls)).toBe(false);
  });

  it("collection: rejects a non-positive amount without querying", async () => {
    const { db, queries } = mockDb([]);
    const out = (await recordCollectionTool.run(db, { amount_omr: -5, confirm: true }, "finance")) as { error: string };
    expect(out.error).toMatch(/positive/);
    expect(queries()).toBe(0);
  });

  it("collection: inserts with confirm, linked to the referenced invoice", async () => {
    const { db, calls } = mockDb([
      { data: [invoice] },
      { data: { id: "C1", amount_omr: 2500, received_date: "2026-07-26" } },
    ]);
    const out = (await recordCollectionTool.run(
      db,
      { amount_omr: 2500, invoice_reference: "INV-100", received_date: "2026-07-26", confirm: true },
      "finance",
    )) as Record<string, unknown>;
    expect(out.recorded).toBe(true);
    expect(calls[1]).toContain("insert");
  });
});

describe("update_unit_status", () => {
  it("errors when no unit matches and writes nothing", async () => {
    const { db, calls } = mockDb([{ data: [] }]);
    const out = (await updateUnitStatusTool.run(db, { reference_id: "NOPE", status: "sold", confirm: true }, "inventory")) as { error: string };
    expect(out.error).toMatch(/no unit/);
    expect(wrote(calls)).toBe(false);
  });

  it("writes only with confirm", async () => {
    const unit = { id: "U1", reference_id: "WZ-101", status: "available" };
    const preview = mockDb([{ data: [unit] }]);
    const p = (await updateUnitStatusTool.run(preview.db, { reference_id: "WZ-101", status: "reserved" }, "inventory")) as Record<string, unknown>;
    expect(p.needs_confirmation).toBe(true);
    expect(wrote(preview.calls)).toBe(false);

    const write = mockDb([{ data: [unit] }, { data: { id: "U1", reference_id: "WZ-101", status: "reserved" } }]);
    const out = (await updateUnitStatusTool.run(write.db, { reference_id: "WZ-101", status: "reserved", confirm: true }, "inventory")) as Record<string, unknown>;
    expect(out.updated).toBe(true);
  });
});

describe("complete_task", () => {
  it("refuses a task addressed to another department", async () => {
    const { db, calls } = mockDb([{ data: { id: "T1", title: "Raise invoice", status: "open", to_department: "finance" } }]);
    const out = (await completeTaskTool.run(db, { task_id: "T1", confirm: true }, "sales")) as { error: string };
    expect(out.error).toMatch(/belongs to 'finance'/);
    expect(wrote(calls)).toBe(false);
  });

  it("completes its own department's task with confirm", async () => {
    const { db } = mockDb([
      { data: { id: "T1", title: "Raise invoice", status: "open", to_department: "finance" } },
      { data: { id: "T1", title: "Raise invoice", status: "done" } },
    ]);
    const out = (await completeTaskTool.run(db, { task_id: "T1", confirm: true }, "finance")) as Record<string, unknown>;
    expect(out.updated).toBe(true);
  });
});
