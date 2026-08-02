import { describe, it, expect } from "vitest";
import { annualStrategy, blendStrategies, dailyStrategy, monthlyStrategy } from "./rental";

describe("dailyStrategy", () => {
  it("computes nights, booking revenue, fees, EGI and NOI (flat occupancy)", () => {
    const r = dailyStrategy({
      adrOmr: 50,
      occupancyPct: 70,
      averageStayNights: 3,
      cleaningFeeOmr: 15,
      cleaningCostOmr: 10,
      platformFeePct: 15,
      tourismFeePct: 5,
      managementFeePct: 10,
      utilitiesOmr: 600,
    });
    // available 365, occupied 255.5 nights, stays 85.2
    expect(r.detail.availableNights).toBe(365);
    expect(r.detail.occupiedNights).toBe(255.5);
    // gross potential 50×365 = 18250; booking 50×255.5 = 12775; vacancy 5475
    expect(r.grossPotentialIncomeOmr).toBe(18250);
    expect(r.detail.grossBookingOmr).toBe(12775);
    expect(r.vacancyLossOmr).toBe(5475);
    // cleaning income 85.1667 stays × 15 = 1277.5
    expect(r.otherIncomeOmr).toBe(1277.5);
    // platform 15% of (12775+1277.5) = 2107.875; tourism 5% of 12775 = 638.75
    // EGI = 14052.5 − 2107.875 − 638.75 = 11305.875
    expect(r.effectiveGrossIncomeOmr).toBe(11305.875);
    // management 10% of EGI = 1130.588; cleaning cost 851.667; utilities 600
    // opex = 2582.255 (platform/tourism already deducted from EGI, not double-counted)
    expect(r.operatingExpensesOmr).toBe(2582.255);
    expect(r.noiOmr).toBe(8723.62);
    expect(r.assumedOccupancyPct).toBe(70);
    // RevPAN = 12775/365 = 35; effective ADR back-computes to 50
    expect(r.detail.revPanOmr).toBe(35);
    expect(r.detail.effectiveAdrOmr).toBe(50);
  });

  it("honours owner-blocked nights and clamps occupancy to 0–100", () => {
    const r = dailyStrategy({ adrOmr: 40, occupancyPct: 120, ownerBlockedNights: 65 });
    expect(r.detail.availableNights).toBe(300);
    expect(r.detail.occupiedNights).toBe(300); // clamped to 100%
    expect(r.assumedOccupancyPct).toBe(100);
  });

  it("uses 12-month seasonality when provided (overrides flat inputs)", () => {
    // 6 high months at ADR 80 / 90% + 6 low months at ADR 30 / 40%
    const seasonality = [
      ...Array(6).fill({ adrOmr: 80, occupancyPct: 90 }),
      ...Array(6).fill({ adrOmr: 30, occupancyPct: 40 }),
    ];
    const r = dailyStrategy({ adrOmr: 999, occupancyPct: 0, seasonality });
    // per month 365/12 nights: high 27.375 occ nights, low 12.1667 occ nights
    // booking = 6×80×27.375 + 6×30×12.1667 = 13140 + 2190 = 15330
    expect(r.detail.grossBookingOmr).toBe(15330);
    // potential = (6×80 + 6×30) × 30.4167 = 660 × 30.41667 = 20075
    expect(r.grossPotentialIncomeOmr).toBe(20075);
    // occupancy = (6×27.375 + 6×12.16667)/365 = 237.25/365 = 65%
    expect(r.assumedOccupancyPct).toBe(65);
  });

  it("zero ADR yields zero income but still itemizes fixed costs", () => {
    const r = dailyStrategy({ adrOmr: 0, occupancyPct: 70, utilitiesOmr: 600 });
    expect(r.effectiveGrossIncomeOmr).toBe(0);
    expect(r.noiOmr).toBe(-600);
    expect(r.operatingExpenseRatioPct).toBeNull(); // EGI 0 → ratio undefined
  });
});

describe("monthlyStrategy", () => {
  it("computes vacancy months, EGI and NOI", () => {
    const r = monthlyStrategy({
      monthlyRentOmr: 600,
      vacancyPct: 10,
      managementFeePct: 5,
      maintenanceOmr: 300,
    });
    // gross 7200; vacancy 1.2 months = 720; EGI 6480
    expect(r.grossPotentialIncomeOmr).toBe(7200);
    expect(r.vacancyLossOmr).toBe(720);
    expect(r.effectiveGrossIncomeOmr).toBe(6480);
    // mgmt 5% of 6480 = 324; +300 maintenance = 624; NOI 5856
    expect(r.operatingExpensesOmr).toBe(624);
    expect(r.noiOmr).toBe(5856);
    expect(r.assumedOccupancyPct).toBe(90);
    expect(r.detail.vacancyMonths).toBe(1.2);
  });

  it("lease-up and rent-free months add to vacancy, capped at 12", () => {
    const r = monthlyStrategy({ monthlyRentOmr: 500, vacancyPct: 50, leaseUpMonths: 4, rentFreeMonths: 3 });
    // 6 + 4 + 3 = 13 → capped at 12 (a year cannot lose more than a year)
    expect(r.detail.vacancyMonths).toBe(12);
    expect(r.effectiveGrossIncomeOmr).toBe(0);
    expect(r.assumedOccupancyPct).toBe(0);
  });
});

describe("annualStrategy", () => {
  it("computes vacancy allowance, leasing commission and NOI", () => {
    const r = annualStrategy({
      annualRentOmr: 7000,
      vacancyAllowancePct: 4,
      leasingCommissionPct: 5,
      serviceChargeOmr: 800,
    });
    expect(r.grossPotentialIncomeOmr).toBe(7000);
    expect(r.vacancyLossOmr).toBe(280);
    expect(r.effectiveGrossIncomeOmr).toBe(6720);
    // leasing 5% of 7000 = 350; +800 service = 1150
    expect(r.operatingExpensesOmr).toBe(1150);
    expect(r.noiOmr).toBe(5570);
    expect(r.detail.monthlyEquivalentRentOmr).toBe(583.333);
    expect(r.assumedOccupancyPct).toBe(96);
  });

  it("zero rent produces negative NOI from fixed costs (an honest loss)", () => {
    const r = annualStrategy({ annualRentOmr: 0, serviceChargeOmr: 900 });
    expect(r.noiOmr).toBe(-900);
    expect(r.operatingExpenseRatioPct).toBeNull();
  });
});

describe("blendStrategies", () => {
  it("weights strategies by time share and normalizes the shares", () => {
    const daily = dailyStrategy({
      adrOmr: 50,
      occupancyPct: 70,
      averageStayNights: 3,
      cleaningFeeOmr: 15,
      cleaningCostOmr: 10,
      platformFeePct: 15,
      tourismFeePct: 5,
      managementFeePct: 10,
      utilitiesOmr: 600,
    });
    const annual = annualStrategy({
      annualRentOmr: 7000,
      vacancyAllowancePct: 4,
      leasingCommissionPct: 5,
      serviceChargeOmr: 800,
    });
    const blend = blendStrategies([
      { result: daily, sharePct: 50 },
      { result: annual, sharePct: 50 },
    ]);
    expect(blend).not.toBeNull();
    // EGI: 11305.875×0.5 + 6720×0.5 = 9012.938 (3dp half-up)
    expect(blend!.effectiveGrossIncomeOmr).toBe(9012.938);
    // opex: 2582.255×0.5 + 1150×0.5 = 1866.128
    expect(blend!.operatingExpensesOmr).toBe(1866.128);
    expect(blend!.noiOmr).toBe(7146.81);
    expect(blend!.strategy).toBe("blended");
    // shares 1/1 behave identically to 50/50 (normalized)
    const blend2 = blendStrategies([
      { result: daily, sharePct: 1 },
      { result: annual, sharePct: 1 },
    ]);
    expect(blend2!.noiOmr).toBe(blend!.noiOmr);
  });

  it("returns null with no usable components and passes through a single one", () => {
    expect(blendStrategies([])).toBeNull();
    const annual = annualStrategy({ annualRentOmr: 6000 });
    const single = blendStrategies([{ result: annual, sharePct: 100 }]);
    expect(single!.noiOmr).toBe(annual.noiOmr);
    expect(single!.strategy).toBe("annual");
  });
});
