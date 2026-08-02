import { describe, it, expect } from "vitest";
import { buildLoanSchedule } from "./financing";
import { buildProjection } from "./projection";

describe("buildProjection — unleveraged completed property", () => {
  const base = {
    priceOmr: 100000,
    initialOutflowOmr: 100000,
    egiOmr: 8000,
    opexOmr: 2000,
    holdYears: 5,
    appreciationPct: 3,
    sellingCostsPct: 2,
    discountRatePct: 8,
  };

  it("builds 5 annual periods with constant NOI and appreciating value", () => {
    const p = buildProjection(base);
    expect(p.periods).toHaveLength(5);
    for (const per of p.periods) {
      expect(per.rentalIncomeOmr).toBe(8000);
      expect(per.operatingExpensesOmr).toBe(2000);
      expect(per.noiOmr).toBe(6000);
      expect(per.debtServiceOmr).toBe(0);
      expect(per.netCashFlowOmr).toBe(6000);
    }
    // year-5 value = 100000 × 1.03^5 = 115927.407
    expect(p.periods[4].propertyValueOmr).toBe(115927.407);
  });

  it("exit via appreciation: value − selling costs − loan balance", () => {
    const p = buildProjection(base);
    expect(p.exit.method).toBe("appreciation");
    expect(p.exit.exitValueOmr).toBe(115927.407);
    expect(p.exit.sellingCostsOmr).toBe(2318.548); // 2%
    expect(p.exit.loanBalanceAtExitOmr).toBe(0);
    expect(p.exit.netSaleProceedsOmr).toBe(113608.859);
  });

  it("equity flows, profit, multiple and value CAGR reconcile", () => {
    const p = buildProjection(base);
    expect(p.equityFlowsOmr).toEqual([-100000, 6000, 6000, 6000, 6000, 119608.859]);
    expect(p.totalCashInOmr).toBe(100000);
    expect(p.totalCashOutOmr).toBe(143608.859);
    expect(p.totalProfitOmr).toBe(43608.859);
    expect(p.equityMultiple).toBe(1.44);
    expect(p.valueCagrPct).toBe(3); // constant growth recovers the input rate
    expect(p.irrPct).toBeGreaterThan(8); // beats the 8% discount rate…
    expect(p.npvOmr).toBeGreaterThan(0); // …so NPV at 8% is positive
  });

  it("escalation and inflation compound from year 2", () => {
    const p = buildProjection({ ...base, rentEscalationPct: 5, expenseInflationPct: 10 });
    expect(p.periods[0].rentalIncomeOmr).toBe(8000);
    expect(p.periods[1].rentalIncomeOmr).toBe(8400); // ×1.05
    expect(p.periods[1].operatingExpensesOmr).toBe(2200); // ×1.10
    expect(p.periods[1].noiOmr).toBe(6200);
  });

  it("renovation-year extra vacancy halves that year's income only", () => {
    const p = buildProjection({ ...base, extraVacancyPctByYear: { 2: 50 } });
    expect(p.periods[0].rentalIncomeOmr).toBe(8000);
    expect(p.periods[1].rentalIncomeOmr).toBe(4000);
    expect(p.periods[1].vacancyLossOmr).toBe(4000);
    expect(p.periods[2].rentalIncomeOmr).toBe(8000);
  });

  it("capex lands in its year and reduces that year's net cash flow", () => {
    const p = buildProjection({ ...base, capexByYear: { 3: 5000 } });
    expect(p.periods[2].capexOmr).toBe(5000);
    expect(p.periods[2].netCashFlowOmr).toBe(1000);
    expect(p.equityFlowsOmr[3]).toBe(1000);
  });
});

describe("buildProjection — exit cap and deltas", () => {
  it("exit-cap method values the exit off forward NOI", () => {
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 100000,
      egiOmr: 8000,
      opexOmr: 2000,
      holdYears: 5,
      exitCapRatePct: 8,
    });
    // forward NOI (year 6, no escalation) = 6000; 6000 / 8% = 75000
    expect(p.exit.method).toBe("exit_cap");
    expect(p.exit.exitValueOmr).toBe(75000);
  });

  it("exitValueDeltaPct stresses the exit value (sensitivity hook)", () => {
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 100000,
      egiOmr: 8000,
      opexOmr: 2000,
      holdYears: 5,
      appreciationPct: 0,
      exitValueDeltaPct: -10,
    });
    expect(p.exit.exitValueOmr).toBe(90000);
  });
});

describe("buildProjection — off-plan with payment plan", () => {
  it("no income before handover + delay; instalments land in their years", () => {
    const p = buildProjection({
      priceOmr: 120000,
      initialOutflowOmr: 5000, // acquisition costs only
      scheduledOutflows: [
        { monthsFromStart: 0, amountOmr: 6000, label: "Reservation" },
        { monthsFromStart: 0, amountOmr: 18000, label: "Down payment" },
        { monthsFromStart: 12, amountOmr: 48000, label: "Instalment 1" },
        { monthsFromStart: 24, amountOmr: 48000, label: "Instalment 2" },
      ],
      egiOmr: 9000,
      opexOmr: 1500,
      handoverMonths: 24,
      holdYears: 5,
    });
    // Years 1–2 pre-handover: zero income, zero opex
    expect(p.periods[0].rentalIncomeOmr).toBe(0);
    expect(p.periods[1].rentalIncomeOmr).toBe(0);
    expect(p.periods[0].operatingExpensesOmr).toBe(0);
    // Year 3 onward: full income
    expect(p.periods[2].noiOmr).toBe(7500);
    // t0 = initial 5000 + month-0 instalments 24000
    expect(p.equityFlowsOmr[0]).toBe(-29000);
    // Instalments hit years 1 and 2
    expect(p.periods[0].plannedOutflowOmr).toBe(48000);
    expect(p.periods[1].plannedOutflowOmr).toBe(48000);
    expect(p.equityFlowsOmr[1]).toBe(-48000);
    // Total cash in = 5000 + 120000 = 125000
    expect(p.totalCashInOmr).toBe(125000);
  });

  it("selling before the plan completes settles the remaining instalments from the sale (no phantom profit)", () => {
    // Zero-economics control: buy at 100000 via a 5-year plan, sell year 3 at
    // 100000 with no rent and no costs. Before the fix this booked +32000
    // profit and 24.96% IRR from the unpaid months-39..60 instalments.
    const outflows = [
      { monthsFromStart: 0, amountOmr: 20000, label: "Reservation + down" },
      ...Array.from({ length: 20 }, (_, i) => ({
        monthsFromStart: (i + 1) * 3,
        amountOmr: 4000,
        label: `Instalment ${i + 1}`,
      })),
    ];
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 0,
      scheduledOutflows: outflows,
      egiOmr: 0,
      opexOmr: 0,
      holdYears: 3,
      appreciationPct: 0,
      sellingCostsPct: 0,
    });
    // 20000 at t0 + 4 instalments/yr × 3 yrs × 4000 = 68000 paid; 32000 still owed
    expect(p.exit.remainingPlanObligationOmr).toBe(32000);
    expect(p.exit.netSaleProceedsOmr).toBe(68000); // 100000 − 32000
    expect(p.totalProfitOmr).toBe(0);
    expect(p.irrPct).toBe(0);
    // Selling in year 1 (before handover) is the extreme case: only 36000 paid
    const early = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 0,
      scheduledOutflows: outflows,
      egiOmr: 0,
      opexOmr: 0,
      holdYears: 1,
      appreciationPct: 0,
      sellingCostsPct: 0,
    });
    expect(early.exit.remainingPlanObligationOmr).toBe(64000);
    expect(early.totalProfitOmr).toBe(0);
  });

  it("holding through the whole plan leaves no remaining obligation", () => {
    const p = buildProjection({
      priceOmr: 120000,
      initialOutflowOmr: 5000,
      scheduledOutflows: [
        { monthsFromStart: 0, amountOmr: 24000, label: "Down" },
        { monthsFromStart: 12, amountOmr: 48000, label: "Instalment 1" },
        { monthsFromStart: 24, amountOmr: 48000, label: "Instalment 2" },
      ],
      egiOmr: 9000,
      opexOmr: 1500,
      handoverMonths: 24,
      holdYears: 5,
    });
    expect(p.exit.remainingPlanObligationOmr).toBe(0);
  });

  it("partial-year handover prorates the first income year", () => {
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 100000,
      egiOmr: 12000,
      opexOmr: 0,
      handoverMonths: 6, // income starts mid-year 1
      holdYears: 2,
    });
    expect(p.periods[0].rentalIncomeOmr).toBe(6000); // half a year
    expect(p.periods[1].rentalIncomeOmr).toBe(12000);
  });

  it("rental-start delay stacks on the handover date", () => {
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 100000,
      egiOmr: 12000,
      opexOmr: 0,
      handoverMonths: 6,
      rentalStartDelayMonths: 3,
      holdYears: 1,
    });
    expect(p.periods[0].rentalIncomeOmr).toBe(3000); // 3 active months
  });
});

describe("buildProjection — leveraged", () => {
  it("debt service and loan balance flow from the schedule; exit repays the balance", () => {
    const loan = buildLoanSchedule({ principalOmr: 60000, annualRatePct: 5, termYears: 20 });
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 40000,
      loan,
      egiOmr: 8000,
      opexOmr: 2000,
      holdYears: 5,
      appreciationPct: 0,
    });
    expect(p.periods[0].debtServiceOmr).toBe(loan.debtServiceByYearOmr[0]);
    expect(p.periods[4].loanBalanceOmr).toBe(loan.balanceByYearOmr[4]);
    // Exit: 100000 − 0 costs − remaining balance
    expect(p.exit.loanBalanceAtExitOmr).toBe(loan.balanceByYearOmr[4]);
    expect(p.exit.netSaleProceedsOmr).toBe(Math.round((100000 - loan.balanceByYearOmr[4]) * 1000) / 1000);
    // Leveraged annual cash flow = NOI − debt service
    expect(p.periods[0].netCashFlowOmr).toBe(
      Math.round((6000 - loan.debtServiceByYearOmr[0]) * 1000) / 1000,
    );
  });
});

describe("buildProjection — monthly granularity", () => {
  it("subdivides years into months and reconciles annual NOI", () => {
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 100000,
      egiOmr: 12000,
      opexOmr: 2400,
      holdYears: 2,
      granularity: "monthly",
    });
    expect(p.periods).toHaveLength(24);
    expect(p.periods[0].rentalIncomeOmr).toBe(1000);
    expect(p.periods[0].operatingExpensesOmr).toBe(200);
    const year1Noi = p.periods.filter((x) => x.year === 1).reduce((a, x) => a + x.noiOmr, 0);
    expect(Math.round(year1Noi)).toBe(9600);
    // Sale proceeds land in the final month only
    expect(p.periods[22].saleProceedsOmr).toBe(0);
    expect(p.periods[23].saleProceedsOmr).toBe(p.exit.netSaleProceedsOmr);
  });

  it("fractional handover months reconcile: monthly income sums to the annual figure", () => {
    const p = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 100000,
      egiOmr: 12000,
      opexOmr: 0,
      handoverMonths: 6.5, // mid-month handover
      holdYears: 2,
      granularity: "monthly",
    });
    const annual = buildProjection({
      priceOmr: 100000,
      initialOutflowOmr: 100000,
      egiOmr: 12000,
      opexOmr: 0,
      handoverMonths: 6.5,
      holdYears: 2,
      granularity: "annual",
    });
    const y1Monthly = p.periods.filter((x) => x.year === 1).reduce((a, x) => a + x.rentalIncomeOmr, 0);
    // Each monthly row rounds to baisa, so allow the accumulated 3-dp drift.
    expect(Math.abs(y1Monthly - annual.periods[0].rentalIncomeOmr)).toBeLessThan(0.01);
    // Active months on the integer grid: months 7..12 = 6 rows with income
    expect(p.periods.filter((x) => x.year === 1 && x.rentalIncomeOmr > 0)).toHaveLength(6);
  });

  it("clamps the hold to 1–30 years", () => {
    expect(buildProjection({
      priceOmr: 1000, initialOutflowOmr: 1000, egiOmr: 100, opexOmr: 0, holdYears: 0,
    }).periods).toHaveLength(1);
    expect(buildProjection({
      priceOmr: 1000, initialOutflowOmr: 1000, egiOmr: 100, opexOmr: 0, holdYears: 99,
    }).periods).toHaveLength(30);
  });
});
