// Server-side zod contract for the Investment Intelligence API. The client
// sends ONLY the engine input; every figure in a saved analysis is computed
// server-side by the deterministic engine — frontend numbers are never
// trusted as the source of truth.
import { z } from "zod";

const money = z.number().finite().min(0).max(1_000_000_000);
const signedMoney = z.number().finite().min(-1_000_000_000).max(1_000_000_000);
const pct = z.number().finite().min(-100).max(1000);
const pct0to100 = z.number().finite().min(0).max(100);

const CostLine = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(160),
  amountOmr: money,
});

const Property = z.object({
  name: z.string().max(160).optional(),
  project: z.string().max(160).optional(),
  developer: z.string().max(160).optional(),
  reference: z.string().max(64).optional(),
  unitType: z.string().max(120).optional(),
  bedrooms: z.number().int().min(0).max(30).nullable().optional(),
  bathrooms: z.number().int().min(0).max(30).nullable().optional(),
  areaSqm: z.number().finite().min(0).max(100000),
  landAreaSqm: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  floor: z.string().max(32).optional(),
  completionStatus: z.enum(["ready", "off_plan"]),
  handoverMonths: z.number().finite().min(0).max(120).optional(),
  completionDate: z.string().max(32).optional(),
  furnishing: z.enum(["furnished", "semi_furnished", "unfurnished", "unknown"]).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  category: z.enum(["ITC", "future_cities", "surooh"]).optional(),
  ownershipEligibility: z.enum(["all_nationalities", "gcc_omani_only"]).optional(),
  askingPriceOmr: money,
  negotiatedPriceOmr: money.nullable().optional(),
  marketValueOmr: money.nullable().optional(),
  dataSource: z.string().max(200).optional(),
  verifiedAt: z.string().max(32).optional(),
});

const Seasonal = z.object({ adrOmr: money, occupancyPct: pct0to100 });

const Daily = z.object({
  adrOmr: money,
  occupancyPct: pct0to100,
  seasonality: z.array(Seasonal).length(12).optional(),
  ownerBlockedNights: z.number().finite().min(0).max(365).optional(),
  averageStayNights: z.number().finite().min(0).max(365).optional(),
  cleaningFeeOmr: money.optional(),
  cleaningCostOmr: money.optional(),
  platformFeePct: pct0to100.optional(),
  paymentFeePct: pct0to100.optional(),
  tourismFeePct: pct0to100.optional(),
  managementFeePct: pct0to100.optional(),
  utilitiesOmr: money.optional(),
  internetOmr: money.optional(),
  consumablesOmr: money.optional(),
  linenHousekeepingOmr: money.optional(),
  maintenanceOmr: money.optional(),
  replacementReserveOmr: money.optional(),
  serviceChargeOmr: money.optional(),
  insuranceOmr: money.optional(),
  otherExpensesOmr: money.optional(),
});

const Monthly = z.object({
  monthlyRentOmr: money,
  vacancyPct: pct0to100.optional(),
  leaseUpMonths: z.number().finite().min(0).max(12).optional(),
  rentFreeMonths: z.number().finite().min(0).max(12).optional(),
  managementFeePct: pct0to100.optional(),
  utilitiesOmr: money.optional(),
  maintenanceOmr: money.optional(),
  serviceChargeOmr: money.optional(),
  insuranceOmr: money.optional(),
  replacementReserveOmr: money.optional(),
  otherExpensesOmr: money.optional(),
});

const Annual = z.object({
  annualRentOmr: money,
  vacancyAllowancePct: pct0to100.optional(),
  leasingCommissionPct: pct0to100.optional(),
  renewalCostsOmr: money.optional(),
  managementFeePct: pct0to100.optional(),
  serviceChargeOmr: money.optional(),
  insuranceOmr: money.optional(),
  maintenanceOmr: money.optional(),
  replacementReserveOmr: money.optional(),
  otherExpensesOmr: money.optional(),
});

const Financing = z.object({
  mode: z.enum(["cash", "mortgage", "payment_plan"]),
  loanOmr: money.optional(),
  ltvPct: pct0to100.optional(),
  annualRatePct: z.number().finite().min(0).max(50).optional(),
  termYears: z.number().finite().min(0).max(40).optional(),
  paymentsPerYear: z.union([z.literal(12), z.literal(4)]).optional(),
  graceMonths: z.number().finite().min(0).max(120).optional(),
  interestOnlyMonths: z.number().finite().min(0).max(240).optional(),
  balloonOmr: money.optional(),
  mortgageFeesOmr: money.optional(),
  plan: z
    .object({
      reservationPct: z.number().finite().min(0).max(1).optional(), // FRACTION (calculators convention)
      reservationOmr: money.optional(),
      downPct: z.number().finite().min(0).max(1).optional(), // FRACTION
      years: z.number().finite().min(1).max(15).optional(),
      installmentsPerYear: z.number().finite().min(1).max(12).optional(),
    })
    .optional(),
});

const yearRecord = z.record(z.string().regex(/^\d{1,2}$/), money).optional();

const Projection = z.object({
  holdYears: z.number().finite().min(1).max(30),
  rentEscalationPct: pct.optional(),
  expenseInflationPct: pct.optional(),
  appreciationPct: pct.optional(),
  exitCapRatePct: z.number().finite().min(0).max(100).optional(),
  sellingCostsPct: pct0to100.optional(),
  discountRatePct: z.number().finite().min(0).max(100).optional(),
  rentalStartDelayMonths: z.number().finite().min(0).max(60).optional(),
  capexByYear: yearRecord,
  extraVacancyPctByYear: z.record(z.string().regex(/^\d{1,2}$/), pct0to100).optional(),
  granularity: z.enum(["annual", "monthly"]).optional(),
});

const Objectives = z.object({
  minGrossYieldPct: pct.optional(),
  minNetYieldPct: pct.optional(),
  minCashOnCashPct: pct.optional(),
  minIrrPct: pct.optional(),
  minDscr: z.number().finite().min(0).max(10).optional(),
  maxLtvPct: pct0to100.optional(),
  maxPaybackYears: z.number().finite().min(0).max(50).optional(),
  minMonthlyCashFlowOmr: signedMoney.optional(),
  minAnnualIncomeOmr: signedMoney.optional(),
  maxInitialCashOmr: money.optional(),
  targetHoldYears: z.number().finite().min(1).max(30).optional(),
  minAppreciationCagrPct: pct.optional(),
  requiredResidencyTier: z.enum(["investor_2yr", "golden_10yr"]).optional(),
  requiredCompletion: z.enum(["ready", "off_plan", "any"]).optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).optional(),
});

const Comparable = z.object({
  reference: z.string().min(1).max(64),
  project: z.string().min(1).max(160),
  unitType: z.string().max(120).optional(),
  bedrooms: z.number().int().min(0).max(30).nullable().optional(),
  areaSqm: z.number().finite().min(0).max(100000),
  askingPriceOmr: money.nullable().optional(),
  transactionPriceOmr: money.nullable().optional(),
  monthlyRentOmr: money.nullable().optional(),
  annualRentOmr: money.nullable().optional(),
  dailyRateOmr: money.nullable().optional(),
  occupancyPct: pct0to100.nullable().optional(),
  distanceKm: z.number().finite().min(0).max(20000).nullable().optional(),
  listingDate: z.string().max(32).optional(),
  dataSource: z.string().min(1).max(200),
  verifiedAt: z.string().max(32).optional(),
  provenance: z.enum(["observed", "estimated", "assumed"]),
});

const TrackedField = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(160),
  value: z.union([z.number().finite(), z.string().max(400), z.null()]),
  provenance: z.enum(["verified", "observed", "estimated", "assumed", "missing"]),
  source: z.string().max(200).optional(),
  verifiedAt: z.string().max(32).optional(),
});

export const AnalysisInputSchema = z.object({
  property: Property,
  acquisition: z.object({
    costLines: z.array(CostLine).max(50),
    contingencyPct: pct0to100.optional(),
  }),
  strategies: z.object({
    daily: Daily.optional(),
    monthly: Monthly.optional(),
    annual: Annual.optional(),
    blendSharesPct: z
      .object({
        daily: pct0to100.optional(),
        monthly: pct0to100.optional(),
        annual: pct0to100.optional(),
      })
      .optional(),
  }),
  activeStrategy: z.enum(["daily", "monthly", "annual", "blended"]),
  financing: Financing,
  projection: Projection,
  objectives: Objectives.optional(),
  objectiveWeights: z.record(z.string().max(40), z.number().finite().min(0).max(100)).optional(),
  comparables: z.array(Comparable).max(200).optional(),
  trackedFields: z.array(TrackedField).max(100).optional(),
});

export const SaveAnalysisSchema = z.object({
  id: z.string().uuid().optional(), // present = re-save (version bump)
  title: z.string().min(1).max(200),
  status: z.enum(["draft", "saved"]).default("saved"),
  input: AnalysisInputSchema,
});

export type ValidatedAnalysisInput = z.infer<typeof AnalysisInputSchema>;
