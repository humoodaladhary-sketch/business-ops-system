// Rental-strategy engine: daily (short-let), monthly (medium-term) and annual
// (long-let) income models that all normalize to one comparable result shape.
// Pure and deterministic. Money is OMR (3 dp); percents are whole percents.
//
// Every output is an ILLUSTRATION of the caller's assumptions (rates,
// occupancy, costs) — never a forecast. The engines only transform what they
// are given; provenance of each input is tracked upstream.
import { d, roundOMR, sumOMR } from "../../money";
import { roundPct, type CostLine } from "./acquisition";

export type StrategyType = "daily" | "monthly" | "annual";

/** Common, comparable annual result every strategy produces. */
export interface StrategyResult {
  strategy: StrategyType | "blended";
  /** Income at full occupancy before any loss, OMR / year. */
  grossPotentialIncomeOmr: number;
  /** Income lost to vacancy / unlet time, OMR / year. */
  vacancyLossOmr: number;
  /** Cleaning-fee income and other operating income, OMR / year. */
  otherIncomeOmr: number;
  /** Gross potential − vacancy + other income, OMR / year. */
  effectiveGrossIncomeOmr: number;
  /** Itemized annual operating expenses (before debt service). */
  expenseLines: CostLine[];
  operatingExpensesOmr: number;
  /** Net operating income = EGI − operating expenses, OMR / year. */
  noiOmr: number;
  /** NOI / 12 — the like-for-like monthly figure, OMR. */
  monthlyNoiOmr: number;
  /** Operating expenses / EGI as a whole percent; null when EGI is 0. */
  operatingExpenseRatioPct: number | null;
  /** Occupancy the strategy assumed, whole percent of available time. */
  assumedOccupancyPct: number;
  /** Strategy-specific extras for display (nights, stays, per-unit rates…). */
  detail: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Daily / short-term
// ---------------------------------------------------------------------------

/** Optional month-by-month seasonality (12 entries, Jan..Dec). */
export interface SeasonalMonth {
  /** Average daily rate for the month, OMR. */
  adrOmr: number;
  /** Occupancy for the month as a whole percent of its available nights. */
  occupancyPct: number;
}

export interface DailyStrategyInput {
  /** Average daily rate, OMR — used when no seasonality is given. */
  adrOmr: number;
  /** Average occupancy as a whole percent — used when no seasonality is given. */
  occupancyPct: number;
  /** Month-by-month ADR/occupancy; when present (12 entries) it overrides the flat inputs. */
  seasonality?: SeasonalMonth[];
  /** Nights per year the owner blocks for personal use. Default 0. */
  ownerBlockedNights?: number;
  /** Average length of stay in nights (drives stay count for cleaning). Default 3. */
  averageStayNights?: number;
  /** Cleaning fee charged to guests per stay, OMR. Default 0. */
  cleaningFeeOmr?: number;
  /** Cleaning cost paid per stay, OMR. Default 0. */
  cleaningCostOmr?: number;
  /** Platform commission as a whole percent of booking + cleaning revenue. Default 0. */
  platformFeePct?: number;
  /** Payment processing as a whole percent of booking + cleaning revenue. Default 0. */
  paymentFeePct?: number;
  /** Tourism / hospitality levy as a whole percent of booking revenue. Default 0. */
  tourismFeePct?: number;
  /** Management fee as a whole percent of effective gross income. Default 0. */
  managementFeePct?: number;
  /** Fixed annual operating costs, OMR / year. */
  utilitiesOmr?: number;
  internetOmr?: number;
  consumablesOmr?: number;
  linenHousekeepingOmr?: number;
  maintenanceOmr?: number;
  replacementReserveOmr?: number;
  serviceChargeOmr?: number;
  insuranceOmr?: number;
  otherExpensesOmr?: number;
}

const DAYS_PER_YEAR = 365;

/**
 * Daily (short-let) strategy.
 *
 * availableNights = 365 − ownerBlockedNights
 * occupiedNights  = Σ month availableNights × month occupancy (or flat occupancy)
 * gross booking   = Σ occupied × ADR ; cleaning income = stays × cleaning fee
 * platform + payment fees apply to booking + cleaning; tourism levy to booking.
 * EGI = booking + cleaning − those fees; management % applies to EGI.
 */
export function dailyStrategy(input: DailyStrategyInput): StrategyResult {
  const {
    adrOmr,
    occupancyPct,
    seasonality,
    ownerBlockedNights = 0,
    averageStayNights = 3,
    cleaningFeeOmr = 0,
    cleaningCostOmr = 0,
    platformFeePct = 0,
    paymentFeePct = 0,
    tourismFeePct = 0,
    managementFeePct = 0,
  } = input;

  const availableNights = Math.max(0, DAYS_PER_YEAR - Math.max(0, ownerBlockedNights));

  // Occupied nights + booking revenue, seasonal when 12 months are provided.
  let occupiedNights = 0;
  let bookingRevenue = d(0);
  if (seasonality && seasonality.length === 12) {
    const nightsPerMonth = availableNights / 12;
    for (const m of seasonality) {
      const occ = Math.min(100, Math.max(0, m.occupancyPct));
      const nights = nightsPerMonth * (occ / 100);
      occupiedNights += nights;
      bookingRevenue = bookingRevenue.plus(d(m.adrOmr).times(nights));
    }
  } else {
    const occ = Math.min(100, Math.max(0, occupancyPct));
    occupiedNights = availableNights * (occ / 100);
    bookingRevenue = d(adrOmr).times(occupiedNights);
  }

  const grossPotential =
    seasonality && seasonality.length === 12
      ? sumOMR(seasonality.map((m) => d(m.adrOmr).times(availableNights / 12).toNumber()))
      : roundOMR(d(adrOmr).times(availableNights));
  const grossBookingOmr = roundOMR(bookingRevenue);
  const vacancyLossOmr = roundOMR(d(grossPotential).minus(grossBookingOmr));

  const stays = averageStayNights > 0 ? occupiedNights / averageStayNights : 0;
  const cleaningIncomeOmr = roundOMR(d(cleaningFeeOmr).times(stays));

  const feeBase = d(grossBookingOmr).plus(cleaningIncomeOmr);
  const platformFees = roundOMR(feeBase.times(platformFeePct).dividedBy(100));
  const paymentFees = roundOMR(feeBase.times(paymentFeePct).dividedBy(100));
  const tourismFees = roundOMR(d(grossBookingOmr).times(tourismFeePct).dividedBy(100));

  const effectiveGrossIncomeOmr = roundOMR(
    d(grossBookingOmr).plus(cleaningIncomeOmr).minus(platformFees).minus(paymentFees).minus(tourismFees),
  );

  const managementOmr = roundOMR(d(effectiveGrossIncomeOmr).times(managementFeePct).dividedBy(100));
  const cleaningCostsOmr = roundOMR(d(cleaningCostOmr).times(stays));

  const expenseLines: CostLine[] = [
    { key: "platformFees", label: `Platform commission (${platformFeePct}%)`, amountOmr: platformFees },
    { key: "paymentFees", label: `Payment processing (${paymentFeePct}%)`, amountOmr: paymentFees },
    { key: "tourismFees", label: `Tourism / hospitality fees (${tourismFeePct}%)`, amountOmr: tourismFees },
    { key: "management", label: `Property management (${managementFeePct}% of EGI)`, amountOmr: managementOmr },
    { key: "cleaningCosts", label: "Cleaning costs", amountOmr: cleaningCostsOmr },
    { key: "utilities", label: "Utilities", amountOmr: roundOMR(input.utilitiesOmr ?? 0) },
    { key: "internet", label: "Internet", amountOmr: roundOMR(input.internetOmr ?? 0) },
    { key: "consumables", label: "Consumables", amountOmr: roundOMR(input.consumablesOmr ?? 0) },
    { key: "linen", label: "Linen & housekeeping", amountOmr: roundOMR(input.linenHousekeepingOmr ?? 0) },
    { key: "maintenance", label: "Maintenance", amountOmr: roundOMR(input.maintenanceOmr ?? 0) },
    { key: "reserve", label: "Replacement reserve", amountOmr: roundOMR(input.replacementReserveOmr ?? 0) },
    { key: "serviceCharge", label: "Service charges", amountOmr: roundOMR(input.serviceChargeOmr ?? 0) },
    { key: "insurance", label: "Insurance", amountOmr: roundOMR(input.insuranceOmr ?? 0) },
    { key: "other", label: "Other operating expenses", amountOmr: roundOMR(input.otherExpensesOmr ?? 0) },
  ];

  // Platform/payment/tourism fees already reduced EGI — exclude them from the
  // expense total so they are not double-counted; they stay in the lines for
  // the explain view (marked by their keys).
  const deductedKeys = new Set(["platformFees", "paymentFees", "tourismFees"]);
  const operatingExpensesOmr = sumOMR(
    expenseLines.filter((l) => !deductedKeys.has(l.key)).map((l) => l.amountOmr),
  );

  const noiOmr = roundOMR(d(effectiveGrossIncomeOmr).minus(operatingExpensesOmr));
  const assumedOccupancyPct =
    availableNights > 0 ? roundPct((occupiedNights / availableNights) * 100) : 0;

  return {
    strategy: "daily",
    grossPotentialIncomeOmr: grossPotential,
    vacancyLossOmr,
    otherIncomeOmr: cleaningIncomeOmr,
    effectiveGrossIncomeOmr,
    expenseLines,
    operatingExpensesOmr,
    noiOmr,
    monthlyNoiOmr: roundOMR(d(noiOmr).dividedBy(12)),
    operatingExpenseRatioPct:
      effectiveGrossIncomeOmr > 0
        ? roundPct(d(operatingExpensesOmr).dividedBy(effectiveGrossIncomeOmr).times(100).toNumber())
        : null,
    assumedOccupancyPct,
    detail: {
      availableNights,
      occupiedNights: Math.round(occupiedNights * 10) / 10,
      stays: Math.round(stays * 10) / 10,
      grossBookingOmr,
      revPanOmr: availableNights > 0 ? roundOMR(d(grossBookingOmr).dividedBy(availableNights)) : 0,
      effectiveAdrOmr: occupiedNights > 0 ? roundOMR(d(grossBookingOmr).dividedBy(occupiedNights)) : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Monthly / medium-term
// ---------------------------------------------------------------------------

export interface MonthlyStrategyInput {
  /** Monthly rent, OMR. */
  monthlyRentOmr: number;
  /** Vacancy as a whole percent of the year. Default 0. */
  vacancyPct?: number;
  /** Months to first tenant in year 1 (lease-up), on top of vacancy. Default 0. */
  leaseUpMonths?: number;
  /** Rent-free months granted per year. Default 0. */
  rentFreeMonths?: number;
  /** Management fee as a whole percent of effective gross income. Default 0. */
  managementFeePct?: number;
  /** Fixed annual operating costs paid by the owner, OMR / year. */
  utilitiesOmr?: number;
  maintenanceOmr?: number;
  serviceChargeOmr?: number;
  insuranceOmr?: number;
  replacementReserveOmr?: number;
  otherExpensesOmr?: number;
}

/**
 * Monthly (medium-term) strategy.
 *
 * Gross scheduled income = rent × 12. Vacancy loss = vacancy% + lease-up +
 * rent-free months (capped at 12 total lost months). Management % applies to
 * the resulting EGI; fixed costs are annual.
 */
export function monthlyStrategy(input: MonthlyStrategyInput): StrategyResult {
  const {
    monthlyRentOmr,
    vacancyPct = 0,
    leaseUpMonths = 0,
    rentFreeMonths = 0,
    managementFeePct = 0,
  } = input;

  const grossPotentialIncomeOmr = roundOMR(d(monthlyRentOmr).times(12));
  const vacancyMonths = Math.min(
    12,
    (Math.min(100, Math.max(0, vacancyPct)) / 100) * 12 + Math.max(0, leaseUpMonths) + Math.max(0, rentFreeMonths),
  );
  const vacancyLossOmr = roundOMR(d(monthlyRentOmr).times(vacancyMonths));
  const effectiveGrossIncomeOmr = roundOMR(d(grossPotentialIncomeOmr).minus(vacancyLossOmr));

  const managementOmr = roundOMR(d(effectiveGrossIncomeOmr).times(managementFeePct).dividedBy(100));
  const expenseLines: CostLine[] = [
    { key: "management", label: `Property management (${managementFeePct}% of EGI)`, amountOmr: managementOmr },
    { key: "utilities", label: "Owner-paid utilities", amountOmr: roundOMR(input.utilitiesOmr ?? 0) },
    { key: "maintenance", label: "Maintenance", amountOmr: roundOMR(input.maintenanceOmr ?? 0) },
    { key: "serviceCharge", label: "Service charges", amountOmr: roundOMR(input.serviceChargeOmr ?? 0) },
    { key: "insurance", label: "Insurance", amountOmr: roundOMR(input.insuranceOmr ?? 0) },
    { key: "reserve", label: "Replacement reserve", amountOmr: roundOMR(input.replacementReserveOmr ?? 0) },
    { key: "other", label: "Other operating expenses", amountOmr: roundOMR(input.otherExpensesOmr ?? 0) },
  ];
  const operatingExpensesOmr = sumOMR(expenseLines.map((l) => l.amountOmr));
  const noiOmr = roundOMR(d(effectiveGrossIncomeOmr).minus(operatingExpensesOmr));
  const occupiedMonths = 12 - vacancyMonths;

  return {
    strategy: "monthly",
    grossPotentialIncomeOmr,
    vacancyLossOmr,
    otherIncomeOmr: 0,
    effectiveGrossIncomeOmr,
    expenseLines,
    operatingExpensesOmr,
    noiOmr,
    monthlyNoiOmr: roundOMR(d(noiOmr).dividedBy(12)),
    operatingExpenseRatioPct:
      effectiveGrossIncomeOmr > 0
        ? roundPct(d(operatingExpensesOmr).dividedBy(effectiveGrossIncomeOmr).times(100).toNumber())
        : null,
    assumedOccupancyPct: roundPct((occupiedMonths / 12) * 100),
    detail: {
      occupiedMonths: Math.round(occupiedMonths * 100) / 100,
      vacancyMonths: Math.round(vacancyMonths * 100) / 100,
      monthlyRentOmr: roundOMR(monthlyRentOmr),
    },
  };
}

// ---------------------------------------------------------------------------
// Annual / long-term
// ---------------------------------------------------------------------------

export interface AnnualStrategyInput {
  /** Annual contract rent, OMR. */
  annualRentOmr: number;
  /** Vacancy allowance between contracts as a whole percent of the year. Default 0. */
  vacancyAllowancePct?: number;
  /** Leasing commission as a whole percent of annual rent, annualized. Default 0. */
  leasingCommissionPct?: number;
  /** Renewal / re-letting costs per year, OMR. Default 0. */
  renewalCostsOmr?: number;
  /** Management fee as a whole percent of effective gross income. Default 0. */
  managementFeePct?: number;
  serviceChargeOmr?: number;
  insuranceOmr?: number;
  maintenanceOmr?: number;
  replacementReserveOmr?: number;
  otherExpensesOmr?: number;
}

/**
 * Annual (long-let) strategy.
 *
 * EGI = contract rent × (1 − vacancy allowance). Leasing commission and
 * renewal costs are treated as annualized operating expenses so the annual
 * figure remains comparable with the other strategies.
 */
export function annualStrategy(input: AnnualStrategyInput): StrategyResult {
  const {
    annualRentOmr,
    vacancyAllowancePct = 0,
    leasingCommissionPct = 0,
    renewalCostsOmr = 0,
    managementFeePct = 0,
  } = input;

  const grossPotentialIncomeOmr = roundOMR(annualRentOmr);
  const vac = Math.min(100, Math.max(0, vacancyAllowancePct));
  const vacancyLossOmr = roundOMR(d(annualRentOmr).times(vac).dividedBy(100));
  const effectiveGrossIncomeOmr = roundOMR(d(grossPotentialIncomeOmr).minus(vacancyLossOmr));

  const managementOmr = roundOMR(d(effectiveGrossIncomeOmr).times(managementFeePct).dividedBy(100));
  const leasingOmr = roundOMR(d(annualRentOmr).times(leasingCommissionPct).dividedBy(100));
  const expenseLines: CostLine[] = [
    { key: "management", label: `Property management (${managementFeePct}% of EGI)`, amountOmr: managementOmr },
    { key: "leasing", label: `Leasing commission (${leasingCommissionPct}%)`, amountOmr: leasingOmr },
    { key: "renewal", label: "Renewal / re-letting costs", amountOmr: roundOMR(renewalCostsOmr) },
    { key: "serviceCharge", label: "Service charges", amountOmr: roundOMR(input.serviceChargeOmr ?? 0) },
    { key: "insurance", label: "Insurance", amountOmr: roundOMR(input.insuranceOmr ?? 0) },
    { key: "maintenance", label: "Maintenance", amountOmr: roundOMR(input.maintenanceOmr ?? 0) },
    { key: "reserve", label: "Replacement reserve", amountOmr: roundOMR(input.replacementReserveOmr ?? 0) },
    { key: "other", label: "Other operating expenses", amountOmr: roundOMR(input.otherExpensesOmr ?? 0) },
  ];
  const operatingExpensesOmr = sumOMR(expenseLines.map((l) => l.amountOmr));
  const noiOmr = roundOMR(d(effectiveGrossIncomeOmr).minus(operatingExpensesOmr));

  return {
    strategy: "annual",
    grossPotentialIncomeOmr,
    vacancyLossOmr,
    otherIncomeOmr: 0,
    effectiveGrossIncomeOmr,
    expenseLines,
    operatingExpensesOmr,
    noiOmr,
    monthlyNoiOmr: roundOMR(d(noiOmr).dividedBy(12)),
    operatingExpenseRatioPct:
      effectiveGrossIncomeOmr > 0
        ? roundPct(d(operatingExpensesOmr).dividedBy(effectiveGrossIncomeOmr).times(100).toNumber())
        : null,
    assumedOccupancyPct: roundPct(100 - vac),
    detail: {
      monthlyEquivalentRentOmr: roundOMR(d(annualRentOmr).dividedBy(12)),
      annualRentOmr: roundOMR(annualRentOmr),
    },
  };
}

// ---------------------------------------------------------------------------
// Blend
// ---------------------------------------------------------------------------

export interface BlendComponent {
  result: StrategyResult;
  /** Share of the year this strategy runs, whole percent. Shares should sum to 100. */
  sharePct: number;
}

/**
 * Blends strategies by time share (e.g. 40% of the year short-let, 60%
 * annual). Every OMR figure is weighted by its share; expense lines are
 * prefixed with the strategy so the itemization stays readable. Shares are
 * normalized to their own sum, so 50/50 and 1/1 behave identically.
 */
export function blendStrategies(components: BlendComponent[]): StrategyResult | null {
  const active = components.filter((c) => c.sharePct > 0);
  const totalShare = active.reduce((acc, c) => acc + c.sharePct, 0);
  if (active.length === 0 || totalShare <= 0) return null;

  const w = (c: BlendComponent) => c.sharePct / totalShare;
  const weighted = (pick: (r: StrategyResult) => number) =>
    sumOMR(active.map((c) => d(pick(c.result)).times(w(c)).toNumber()));

  const expenseLines: CostLine[] = active.flatMap((c) =>
    c.result.expenseLines
      .filter((l) => l.amountOmr !== 0)
      .map((l) => ({
        key: `${c.result.strategy}:${l.key}`,
        label: `${c.result.strategy} · ${l.label}`,
        amountOmr: roundOMR(d(l.amountOmr).times(w(c))),
      })),
  );

  const effectiveGrossIncomeOmr = weighted((r) => r.effectiveGrossIncomeOmr);
  const operatingExpensesOmr = weighted((r) => r.operatingExpensesOmr);
  const noiOmr = roundOMR(d(effectiveGrossIncomeOmr).minus(operatingExpensesOmr));

  return {
    strategy: active.length === 1 ? active[0].result.strategy : "blended",
    grossPotentialIncomeOmr: weighted((r) => r.grossPotentialIncomeOmr),
    vacancyLossOmr: weighted((r) => r.vacancyLossOmr),
    otherIncomeOmr: weighted((r) => r.otherIncomeOmr),
    effectiveGrossIncomeOmr,
    expenseLines,
    operatingExpensesOmr,
    noiOmr,
    monthlyNoiOmr: roundOMR(d(noiOmr).dividedBy(12)),
    operatingExpenseRatioPct:
      effectiveGrossIncomeOmr > 0
        ? roundPct(d(operatingExpensesOmr).dividedBy(effectiveGrossIncomeOmr).times(100).toNumber())
        : null,
    assumedOccupancyPct: roundPct(
      active.reduce((acc, c) => acc + c.result.assumedOccupancyPct * w(c), 0),
    ),
    detail: Object.fromEntries(active.map((c) => [`${c.result.strategy}SharePct`, roundPct(w(c) * 100)])),
  };
}
