// The CEO copilot's tools. These assert the behaviour the agent's answers depend
// on — above all the rules it must never break: a role only shows the metrics it
// owns, null is never zero, the founder is not an advisor, and gaps stay visible.
import { describe, expect, it } from "vitest";

import { ceoTools } from "./ceoTools";
import { getDepartment } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

const AS_OF = "2026-08-25";
const NO_DB = null as unknown as SupabaseClient;

async function call(name: string, input: Record<string, unknown> = {}): Promise<Record<string, any>> {
  const tool = ceoTools.find((t) => t.name === name);
  if (!tool) throw new Error(`No tool ${name}`);
  return (await tool.run(NO_DB, { as_of: AS_OF, ...input }, "ceo")) as Record<string, any>;
}

describe("the department is wired up", () => {
  it("registers a CEO department that needs no database", () => {
    const dept = getDepartment("ceo")!;
    expect(dept).toBeDefined();
    expect(dept.requiresDb).toBe(false);
    expect(dept.tools).toBe(ceoTools);
  });

  it("marks every tool as database-free, so the loop runs without Supabase", () => {
    expect(ceoTools.every((t) => t.needsDb === false)).toBe(true);
  });

  it("gives every tool a name, a description and a valid schema", () => {
    for (const tool of ceoTools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(60);
      expect(tool.input_schema.type).toBe("object");
    }
    expect(new Set(ceoTools.map((t) => t.name)).size).toBe(ceoTools.length);
  });

  it("does not include the shared database-backed tools", () => {
    const names = ceoTools.map((t) => t.name);
    expect(names).not.toContain("handoff_to_department");
    expect(names).not.toContain("inbox");
  });
});

describe("company_position", () => {
  it("reports the verified company figures", async () => {
    const out = await call("company_position");
    expect(out.totals.deals).toBe(38);
    expect(Math.round(out.totals.volume_omr)).toBe(3_091_226);
    expect(Math.round(out.totals.company_net_omr)).toBe(69_556);
    expect(Math.round(out.cost.total_people_cost_omr)).toBe(38_950);
    expect(Math.round(out.net_omr)).toBe(30_606);
    expect(out.return_multiple).toBeCloseTo(1.8, 1);
    expect(out.derived_rates.effective_commission_rate_pct).toBeCloseTo(3.6338, 4);
    expect(out.derived_rates.company_keep_rate_pct).toBeCloseTo(2.2501, 4);
  });

  it("separates the owner distribution without hiding it from company cost", async () => {
    const out = await call("company_position");
    expect(Math.round(out.cost.owner_distribution_omr)).toBe(16_000);
    expect(Math.round(out.cost.operating_cost_omr)).toBe(22_950);
  });

  it("carries the unpriced-cost gap onto the answer", async () => {
    const out = await call("company_position");
    expect(out.current_month.unpriced_cost_items).toBe(7);
    expect(out.data_gaps.note).toMatch(/understated/);
  });

  it("surfaces the provision with no amount rather than a zero", async () => {
    const out = await call("company_position");
    expect(out.open_provisions).toHaveLength(1);
    expect(out.open_provisions[0].amount_omr).toBeNull();
    expect(out.open_provisions[0].flag).toMatch(/confirm with SPF/);
  });
});

describe("person_report respects what the role owns", () => {
  it("gives an advisor the full revenue picture and a direction", async () => {
    const out = await call("person_report", { person: "Shatha" });
    expect(out.person.revenue_scored).toBe(true);
    expect(out.since_day_one.lifetime_return).toBeCloseTo(13.8, 1);
    expect(out.since_day_one.payback_month).toBe("2026-01");
    expect(["improving", "declining", "steady"]).toContain(out.since_day_one.direction);
  });

  it("gives a marketing manager NO revenue metrics — null, never zero", async () => {
    const out = await call("person_report", { person: "Abeer" });
    expect(out.person.revenue_scored).toBe(false);
    expect(out.month.volume_omr).toBeNull();
    expect(out.month.deals).toBeNull();
    expect(out.month.current_bonus_band).toBeNull();
    expect(out.since_day_one.lifetime_return).toBeNull();
    expect(out.since_day_one.total_brought_in_omr).toBeNull();
    // Her cost is always shown — the CEO needs the full cost picture.
    expect(Math.round(out.since_day_one.total_cost_omr)).toBe(3_600);
    expect(out.since_day_one.payback_note).toMatch(/own KPIs/);
  });

  it("does not measure the founder against the advisor target or bands", async () => {
    const out = await call("person_report", { person: "Humood" });
    expect(out.person.bonus_eligible).toBe(false);
    expect(out.month.target_omr).toBeNull();
    expect(out.month.current_bonus_band).toBeNull();
    expect(out.month.pace_index).toBeNull();
    // But his own volume is real and is shown.
    expect(out.month.volume_omr).toBeGreaterThan(0);
    expect(out.since_day_one.payback_note).toBe("not yet");
  });

  it("resolves a person by id, English name or Arabic name", async () => {
    for (const needle of ["wesam", "Wesam Zain", "وسام"]) {
      const out = await call("person_report", { person: needle });
      expect(out.person.id).toBe("wesam");
    }
  });

  it("lists who it knows rather than guessing at an unknown name", async () => {
    const out = await call("person_report", { person: "Nobody" });
    expect(out.error).toMatch(/No person matching/);
    expect(out.known_people).toHaveLength(12);
  });

  it("keeps a departed advisor answerable", async () => {
    const out = await call("person_report", { person: "pasha" });
    expect(out.person.active).toBe(false);
    expect(out.person.ended_at).toBe("2026-05-31");
    expect(out.since_day_one.tenure_months).toBe(5);
  });
});

describe("people_standings", () => {
  it("ranks advisors and keeps the founder out of that list", async () => {
    const out = await call("people_standings");
    expect(out.advisors_ranked.map((a: any) => a.id)).toEqual([
      "shatha", "pasha", "wesam", "alex", "yousef",
    ]);
    expect(out.advisors_ranked.map((a: any) => a.id)).not.toContain("humood");
    expect(out.owner.map((o: any) => o.id)).toEqual(["humood"]);
  });

  it("shows support staff cost but null revenue", async () => {
    const out = await call("people_standings");
    expect(out.kpi_scored_staff).toHaveLength(6);
    for (const row of out.kpi_scored_staff) {
      expect(row.cost_omr).toBeGreaterThan(0);
      expect(row.brought_in_omr).toBeNull();
      expect(row.return_multiple).toBeNull();
    }
  });

  it("pairs every advisor multiple with a direction", async () => {
    const out = await call("people_standings");
    for (const advisor of out.advisors_ranked) {
      expect(advisor.direction).toBeTruthy();
    }
  });
});

describe("cost_and_break_even", () => {
  it("prices the September policy change from the policy, not a constant", async () => {
    const out = await call("cost_and_break_even", { policy_month: "2026-08", compare_month: "2026-09" });
    expect(out.primary.run_rate.payroll_omr).toBe(4_650);
    expect(out.compare.run_rate.payroll_omr).toBe(4_993.5);
    expect(out.difference.payroll_omr).toBe(343.5);
    expect(out.primary.run_rate.break_even_volume_omr).toBe(231_122);
    expect(out.compare.run_rate.break_even_volume_omr).toBe(246_388);
    expect(out.difference.break_even_volume_omr).toBe(15_266);
  });

  it("uses the 10 active people for the run rate", async () => {
    const out = await call("cost_and_break_even", { policy_month: "2026-08" });
    expect(out.primary.run_rate.active_headcount).toBe(10);
  });

  it("distinguishes the run rate from what a past month actually cost", async () => {
    const out = await call("cost_and_break_even", { policy_month: "2026-01" });
    // January carried Pasha and Yousef too.
    expect(out.primary.historical_that_month.payroll_omr).toBe(5_300);
    expect(out.primary.run_rate.payroll_omr).toBe(4_650);
  });

  it("names the policy in force and its statutory rules", async () => {
    const out = await call("cost_and_break_even", { policy_month: "2026-09" });
    expect(out.primary.policy.id).toBe("statutory-2026-09");
    expect(out.primary.policy.social_insurance.rate_pct).toBe(11.5);
    expect(out.primary.policy.end_of_service.divisor).toBe(12);
  });
});

describe("break-even is quoted identically by every tool", () => {
  it("agrees across company_position, cost_and_break_even and month_detail", async () => {
    const [a, b, c] = await Promise.all([
      call("company_position"),
      call("cost_and_break_even", { policy_month: "2026-08" }),
      call("month_detail", { month: "2026-08" }),
    ]);
    expect(a.current_month.break_even_volume_omr).toBe(231_122);
    expect(b.primary.run_rate.break_even_volume_omr).toBe(231_122);
    expect(c.projection.break_even_volume_omr).toBe(231_122);
  });
});

describe("cash_gap", () => {
  it("never lists an already-collected deal as awaiting an invoice", async () => {
    const out = await call("cash_gap");
    expect(out.awaiting_invoice.deals.map((d: any) => d.ref)).not.toContain("HUM-0004");
  });

  it("reports the referral liabilities owed out", async () => {
    const out = await call("cash_gap");
    expect(out.referral_liabilities_owed_out.total_omr).toBe(3_054.2);
    expect(out.referral_liabilities_owed_out.payees).toHaveLength(2);
  });

  it("keeps the two stages disjoint", async () => {
    const out = await call("cash_gap");
    const invoicing = new Set(out.awaiting_invoice.deals.map((d: any) => d.ref));
    for (const d of out.awaiting_collection.deals) expect(invoicing.has(d.ref)).toBe(false);
  });
});

describe("data_quality tells the CEO what it does not know", () => {
  it("reports every gap and the advisor-cut anomaly", async () => {
    const out = await call("data_quality");
    expect(out.unpriced_cost_items.count).toBe(7);
    expect(out.open_provisions[0].amount_omr).toBeNull();
    expect(out.advisor_cut_anomalies.count).toBe(2);
    expect(out.advisor_cut_anomalies.total_difference_omr).toBeCloseTo(58.416, 3);
    expect(out.advisor_cut_anomalies.rows.map((r: any) => r.ref).sort()).toEqual(["ALE-0002", "ALE-0003"]);
  });

  it("raises no payroll-classification gap while none applies", async () => {
    const out = await call("data_quality");
    expect(out.unconfirmed_payroll_classification).toEqual([]);
  });
});

describe("settings_and_scenarios", () => {
  it("reports the target, bands and the re-basing scenario", async () => {
    const out = await call("settings_and_scenarios");
    expect(out.advisor_monthly_target_omr).toBe(250_000);
    expect(out.target_band_omr).toBe(60_000);
    expect(out.bonus_bands.map((b: any) => b.bonus_omr)).toEqual([0, 150, 200, 250]);
    expect(out.wage_rebasing_scenario.monthly_increase_omr).toBe(97.75);
    expect(out.wage_rebasing_scenario.annual_increase_omr).toBe(1_173);
    expect(out.wage_rebasing_scenario.note).toMatch(/scenario only/);
  });

  it("flags that no holidays are entered yet", async () => {
    const out = await call("settings_and_scenarios");
    expect(out.holidays).toEqual([]);
    expect(out.holidays_note).toMatch(/Fridays and Saturdays only/);
  });
});

describe("pace is suppressed rather than estimated", () => {
  it("gives no projection early in a month", async () => {
    const out = await call("month_detail", { month: "2026-08", as_of: "2026-08-02" });
    expect(out.pace.measurable).toBe(false);
    expect(out.pace.note).toMatch(/Not yet measurable/);
    expect(out.projection.projected_volume_omr).toBeNull();
    expect(out.projection.covers_itself).toBeNull();
  });
});

describe("list_deals and trend_by_month", () => {
  it("filters deals and totals what matched", async () => {
    const out = await call("list_deals", { developer: "sarooj", limit: 3 });
    expect(out.matched).toBe(13);
    expect(out.shown).toBe(3);
    expect(out.totals_of_all_matched.deals).toBe(13);
  });

  it("returns a month series including empty months", async () => {
    const out = await call("trend_by_month", { person: "alex", from_month: "2026-01", to_month: "2026-08" });
    expect(out.series).toHaveLength(8);
    expect(out.series[0].deals).toBe(0);
    expect(out.series[0].contribution_omr).toBe(-350);
    expect(out.series[1].deals).toBe(3);
  });
});

describe("bonus_check", () => {
  it("bands a volume and names what the next band needs", async () => {
    const out = await call("bonus_check", { volume_omr: 205_000 });
    expect(out.band.id).toBe("on-target");
    expect(out.band.bonus_omr).toBe(150);
    expect(out.next_band.id).toBe("above");
    expect(out.next_band.shortfall_omr).toBe(105_000);
  });

  it("rejects a non-numeric volume rather than guessing", async () => {
    const out = await call("bonus_check", { volume_omr: "lots" });
    expect(out.error).toMatch(/must be a number/);
  });
});
