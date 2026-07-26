// Aging is deterministic money math — every bucket boundary is pinned here.
import { describe, expect, it } from "vitest";
import { classifyAging, summarizeAging, type AgingInvoice } from "./aging";

const AS_OF = new Date("2026-07-26T10:00:00Z");

describe("classifyAging", () => {
  it("classifies a missing or garbage due date as unverified — never guessed", () => {
    expect(classifyAging({ dueDate: null, asOf: AS_OF }).bucket).toBe("due_date_unverified");
    expect(classifyAging({ dueDate: "not-a-date", asOf: AS_OF }).bucket).toBe("due_date_unverified");
  });

  it("pins every bucket boundary", () => {
    const at = (d: string) => classifyAging({ dueDate: d, asOf: AS_OF });
    expect(at("2026-09-01")).toEqual({ bucket: "not_yet_due", daysOverdue: null }); // far future
    expect(at("2026-08-03")).toEqual({ bucket: "not_yet_due", daysOverdue: null }); // 8 days out
    expect(at("2026-08-02")).toEqual({ bucket: "due_soon", daysOverdue: null }); // 7 days out
    expect(at("2026-07-26")).toEqual({ bucket: "due_soon", daysOverdue: null }); // due today
    expect(at("2026-07-25")).toEqual({ bucket: "overdue_1_7", daysOverdue: 1 });
    expect(at("2026-07-19")).toEqual({ bucket: "overdue_1_7", daysOverdue: 7 });
    expect(at("2026-07-18")).toEqual({ bucket: "overdue_8_30", daysOverdue: 8 });
    expect(at("2026-06-26")).toEqual({ bucket: "overdue_8_30", daysOverdue: 30 });
    expect(at("2026-06-25")).toEqual({ bucket: "overdue_31_60", daysOverdue: 31 });
    expect(at("2026-05-27")).toEqual({ bucket: "overdue_31_60", daysOverdue: 60 });
    expect(at("2026-05-26")).toEqual({ bucket: "overdue_61_90", daysOverdue: 61 });
    expect(at("2026-04-27")).toEqual({ bucket: "overdue_61_90", daysOverdue: 90 });
    expect(at("2026-04-26")).toEqual({ bucket: "overdue_90_plus", daysOverdue: 91 });
  });
});

describe("summarizeAging", () => {
  const inv = (over: Partial<AgingInvoice>): AgingInvoice => ({
    reference: "INV-1",
    developer: "Sarooj",
    amountOmr: 1000,
    status: "sent",
    dueDate: "2026-07-01",
    ...over,
  });

  it("excludes paid and cancelled invoices from the open queue", () => {
    const s = summarizeAging(
      [inv({}), inv({ reference: "PAID", status: "paid" }), inv({ reference: "VOID", status: "cancelled" })],
      AS_OF,
    );
    expect(s.openCount).toBe(1);
    expect(s.queue.map((q) => q.reference)).toEqual(["INV-1"]);
  });

  it("separates outstanding from overdue and totals buckets", () => {
    const s = summarizeAging(
      [
        inv({ reference: "FUTURE", dueDate: "2026-09-01", amountOmr: 500 }),
        inv({ reference: "OD25", dueDate: "2026-07-01", amountOmr: 2000 }), // 25 days overdue
        inv({ reference: "NODATE", dueDate: null, amountOmr: 300 }),
      ],
      AS_OF,
    );
    expect(s.openAmountOmr).toBe(2800);
    expect(s.overdueAmountOmr).toBe(2000); // NOT 2800 — unverified and future are not overdue
    expect(s.overdueCount).toBe(1);
    expect(s.buckets.overdue_8_30).toEqual({ count: 1, amountOmr: 2000 });
    expect(s.buckets.due_date_unverified).toEqual({ count: 1, amountOmr: 300 });
    expect(s.buckets.not_yet_due).toEqual({ count: 1, amountOmr: 500 });
  });

  it("sorts the queue worst-first: most days overdue, then largest amount, then unverified", () => {
    const s = summarizeAging(
      [
        inv({ reference: "SMALL_OLD", dueDate: "2026-04-01", amountOmr: 100 }),
        inv({ reference: "BIG_RECENT", dueDate: "2026-07-20", amountOmr: 9000 }),
        inv({ reference: "NODATE", dueDate: null, amountOmr: 5000 }),
        inv({ reference: "BIG_OLD", dueDate: "2026-04-01", amountOmr: 8000 }),
      ],
      AS_OF,
    );
    expect(s.queue.map((q) => q.reference)).toEqual(["BIG_OLD", "SMALL_OLD", "BIG_RECENT", "NODATE"]);
  });
});
