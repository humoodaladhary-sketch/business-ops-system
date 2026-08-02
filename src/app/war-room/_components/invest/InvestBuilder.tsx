"use client";

// Pro Mode · Invest — guided investment analysis over the deterministic
// engine in src/domain/realestate/investment/. The engine runs client-side
// for live feedback (debounced); saving POSTs the INPUT to /api/invest —
// the server recomputes and stores its own result (frontend numbers are
// never the stored truth).
import { useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp, Save, FolderOpen, Copy } from "lucide-react";
import {
  runInvestmentAnalysis,
  type InvestmentAnalysisInput,
  type InvestmentAnalysisResult,
} from "@/domain/realestate/investment/analyze";
import type { ObjectiveProfile } from "@/domain/realestate/investment/objectives";
import type { ComparableProperty } from "@/domain/realestate/investment/comparables";
import type { SourcedValue } from "@/domain/realestate/investment/provenance";
import type { StrategyType } from "@/domain/realestate/investment/rental";
import type { CostLine } from "@/domain/realestate/investment/acquisition";
import { DEFAULT_FEE_ASSUMPTIONS } from "@/domain/realestate/investment/assumptions";
import type { OfferUnit } from "@/domain/realestate/offer";
import type { LiveOfferUnit } from "../../../_data/warRoomUnits";
import { formatOMR } from "../../../lib/format";
import { SectionTitle } from "../../../components/ui";
import { UnitPicker } from "../UnitPicker";
import { NumberField, SelectField, StepCard, TextField, ToggleChip } from "./fields";
import { ResultsPanel } from "./ResultsPanel";
import { ReportSheet } from "./ReportSheet";
import { ComparablesPanel } from "./ComparablesPanel";

// ---------------------------------------------------------------------------
// UI state shapes
// ---------------------------------------------------------------------------

interface PropState {
  name: string;
  project: string;
  developer: string;
  reference: string;
  unitType: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  landAreaSqm: number;
  floor: string;
  completionStatus: "ready" | "off_plan";
  handoverMonths: number;
  furnishing: "furnished" | "semi_furnished" | "unfurnished" | "unknown";
  location: string;
  latitude: number;
  longitude: number;
  category: "ITC" | "future_cities" | "surooh";
  askingPriceOmr: number;
  negotiatedPriceOmr: number;
  marketValueOmr: number;
  prefilledFrom: string; // live-inventory reference, "" when manual
}

const EMPTY_PROP: PropState = {
  name: "",
  project: "",
  developer: "",
  reference: "",
  unitType: "",
  bedrooms: 0,
  bathrooms: 0,
  areaSqm: 0,
  landAreaSqm: 0,
  floor: "",
  completionStatus: "ready",
  handoverMonths: 0,
  furnishing: "unknown",
  location: "",
  latitude: 0,
  longitude: 0,
  category: "ITC",
  askingPriceOmr: 0,
  negotiatedPriceOmr: 0,
  marketValueOmr: 0,
  prefilledFrom: "",
};

interface AcqState {
  registrationOmr: number;
  legalOmr: number;
  agencyOmr: number;
  mortgageArrangementOmr: number;
  valuationOmr: number;
  furnishingOmr: number;
  renovationOmr: number;
  initialMaintenanceOmr: number;
  utilityDepositsOmr: number;
  insuranceOmr: number;
  reservationFeeOmr: number;
  otherOmr: number;
  contingencyPct: number;
}

const EMPTY_ACQ: AcqState = {
  registrationOmr: 0,
  legalOmr: 0,
  agencyOmr: 0,
  mortgageArrangementOmr: 0,
  valuationOmr: 0,
  furnishingOmr: 0,
  renovationOmr: 0,
  initialMaintenanceOmr: 0,
  utilityDepositsOmr: 0,
  insuranceOmr: 0,
  reservationFeeOmr: 0,
  otherOmr: 0,
  contingencyPct: 5,
};

interface DailyState {
  enabled: boolean;
  adrOmr: number;
  occupancyPct: number;
  ownerBlockedNights: number;
  averageStayNights: number;
  cleaningFeeOmr: number;
  cleaningCostOmr: number;
  platformFeePct: number;
  paymentFeePct: number;
  tourismFeePct: number;
  managementFeePct: number;
  utilitiesOmr: number;
  internetOmr: number;
  consumablesOmr: number;
  linenHousekeepingOmr: number;
  maintenanceOmr: number;
  replacementReserveOmr: number;
  serviceChargeOmr: number;
  insuranceOmr: number;
  otherExpensesOmr: number;
}

interface MonthlyState {
  enabled: boolean;
  monthlyRentOmr: number;
  vacancyPct: number;
  leaseUpMonths: number;
  rentFreeMonths: number;
  managementFeePct: number;
  utilitiesOmr: number;
  maintenanceOmr: number;
  serviceChargeOmr: number;
  insuranceOmr: number;
  replacementReserveOmr: number;
  otherExpensesOmr: number;
}

interface AnnualState {
  enabled: boolean;
  annualRentOmr: number;
  vacancyAllowancePct: number;
  leasingCommissionPct: number;
  renewalCostsOmr: number;
  managementFeePct: number;
  serviceChargeOmr: number;
  insuranceOmr: number;
  maintenanceOmr: number;
  replacementReserveOmr: number;
  otherExpensesOmr: number;
}

interface FinState {
  mode: "cash" | "mortgage" | "payment_plan";
  ltvPct: number;
  annualRatePct: number;
  termYears: number;
  paymentsPerYear: 12 | 4;
  graceMonths: number;
  interestOnlyMonths: number;
  balloonOmr: number;
  mortgageFeesOmr: number;
  planReservationPct: number; // whole percent in the UI → fraction at the boundary
  planDownPct: number;
  planYears: number;
  planPerYear: number;
}

interface ProjState {
  holdYears: number;
  rentEscalationPct: number;
  expenseInflationPct: number;
  appreciationPct: number;
  exitCapRatePct: number;
  sellingCostsPct: number;
  discountRatePct: number;
  rentalStartDelayMonths: number;
}

interface ObjState {
  minGrossYieldPct: number;
  minNetYieldPct: number;
  minCashOnCashPct: number;
  minIrrPct: number;
  minDscr: number;
  maxLtvPct: number;
  maxPaybackYears: number;
  minMonthlyCashFlowOmr: number;
  requirePositiveCashFlow: boolean;
  maxInitialCashOmr: number;
  minAppreciationCagrPct: number;
  requiredResidencyTier: "" | "investor_2yr" | "golden_10yr";
  requiredCompletion: "any" | "ready" | "off_plan";
}

interface SavedRow {
  id: string;
  title: string;
  unit_reference: string | null;
  status: string;
  analysis_version: number;
  updated_at: string;
}

const pctStr = (n: number) => `${n.toFixed(2)}%`;

/** Drop the UI-only `enabled` flag before handing a strategy to the engine. */
function stripEnabled<T extends { enabled: boolean }>(state: T): Omit<T, "enabled"> {
  const { enabled: _enabled, ...rest } = state;
  return rest;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvestBuilder({
  liveUnits,
  onSendToOffer,
}: {
  liveUnits: LiveOfferUnit[];
  onSendToOffer: (unit: OfferUnit) => void;
}) {
  const [prop, setProp] = useState<PropState>(EMPTY_PROP);
  const [acq, setAcq] = useState<AcqState>(EMPTY_ACQ);
  const [daily, setDaily] = useState<DailyState>({
    enabled: false,
    adrOmr: 45,
    occupancyPct: 60,
    ownerBlockedNights: 0,
    averageStayNights: 3,
    cleaningFeeOmr: 10,
    cleaningCostOmr: 8,
    platformFeePct: 15,
    paymentFeePct: 0,
    tourismFeePct: 5,
    managementFeePct: 15,
    utilitiesOmr: 700,
    internetOmr: 240,
    consumablesOmr: 150,
    linenHousekeepingOmr: 200,
    maintenanceOmr: 400,
    replacementReserveOmr: 300,
    serviceChargeOmr: 0,
    insuranceOmr: 100,
    otherExpensesOmr: 0,
  });
  const [monthly, setMonthly] = useState<MonthlyState>({
    enabled: false,
    monthlyRentOmr: 0,
    vacancyPct: 8,
    leaseUpMonths: 0,
    rentFreeMonths: 0,
    managementFeePct: 8,
    utilitiesOmr: 0,
    maintenanceOmr: 300,
    serviceChargeOmr: 0,
    insuranceOmr: 100,
    replacementReserveOmr: 200,
    otherExpensesOmr: 0,
  });
  const [annual, setAnnual] = useState<AnnualState>({
    enabled: true,
    annualRentOmr: 0,
    vacancyAllowancePct: 4,
    leasingCommissionPct: 0,
    renewalCostsOmr: 0,
    managementFeePct: 5,
    serviceChargeOmr: 0,
    insuranceOmr: 100,
    maintenanceOmr: 300,
    replacementReserveOmr: 200,
    otherExpensesOmr: 0,
  });
  const [active, setActive] = useState<StrategyType | "blended">("annual");
  const [blendDaily, setBlendDaily] = useState(40);
  const [blendAnnual, setBlendAnnual] = useState(60);
  const [fin, setFin] = useState<FinState>({
    mode: "cash",
    ltvPct: 60,
    annualRatePct: 5.5,
    termYears: 20,
    paymentsPerYear: 12,
    graceMonths: 0,
    interestOnlyMonths: 0,
    balloonOmr: 0,
    mortgageFeesOmr: 0,
    planReservationPct: 5,
    planDownPct: 15,
    planYears: 5,
    planPerYear: 4,
  });
  const [proj, setProj] = useState<ProjState>({
    holdYears: 5,
    rentEscalationPct: 2,
    expenseInflationPct: 2,
    appreciationPct: 3,
    exitCapRatePct: 0,
    sellingCostsPct: 2,
    discountRatePct: 8,
    rentalStartDelayMonths: 0,
  });
  const [obj, setObj] = useState<ObjState>({
    minGrossYieldPct: 0,
    minNetYieldPct: 6,
    minCashOnCashPct: 0,
    minIrrPct: 0,
    minDscr: 0,
    maxLtvPct: 0,
    maxPaybackYears: 0,
    minMonthlyCashFlowOmr: 0,
    requirePositiveCashFlow: false,
    maxInitialCashOmr: 0,
    minAppreciationCagrPct: 0,
    requiredResidencyTier: "",
    requiredCompletion: "any",
  });
  const [comparables, setComparables] = useState<ComparableProperty[]>([]);

  // Save / history / report state
  const [savedId, setSavedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "setup">("idle");
  const [saveDetail, setSaveDetail] = useState("");
  const [history, setHistory] = useState<SavedRow[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // -------------------------------------------------------------------
  // Prefill from live inventory
  // -------------------------------------------------------------------
  function applyUnit(u: LiveOfferUnit) {
    setProp((p) => ({
      ...p,
      project: u.project,
      developer: u.developer,
      reference: u.reference,
      unitType: u.unitType,
      bedrooms: u.bedrooms ?? 0,
      areaSqm: u.areaSqm,
      category: u.category,
      askingPriceOmr: u.priceOmr,
      prefilledFrom: u.reference,
    }));
    if (!title) setTitle(`${u.reference} · ${u.project}`);
  }

  /** Standard Oman acquisition assumptions (each carries source + date in assumptions.ts). */
  function applyStandardCosts() {
    const price = prop.negotiatedPriceOmr > 0 ? prop.negotiatedPriceOmr : prop.askingPriceOmr;
    const reg = DEFAULT_FEE_ASSUMPTIONS.find((a) => a.key === "registrationFeePct");
    const legal = DEFAULT_FEE_ASSUMPTIONS.find((a) => a.key === "legalFeesOmr");
    const val = DEFAULT_FEE_ASSUMPTIONS.find((a) => a.key === "valuationFeeOmr");
    setAcq((a) => ({
      ...a,
      registrationOmr: reg ? Math.round(price * (reg.value / 100) * 1000) / 1000 : a.registrationOmr,
      legalOmr: legal ? legal.value : a.legalOmr,
      valuationOmr: fin.mode === "mortgage" && val ? val.value : 0,
    }));
  }

  // -------------------------------------------------------------------
  // Engine input assembly (debounced) + result
  // -------------------------------------------------------------------
  const engineInput = useMemo<InvestmentAnalysisInput>(() => {
    const unset = (n: number) => (n > 0 ? n : undefined);
    const costLines: CostLine[] = [
      { key: "registrationFee", label: "Registration fees", amountOmr: acq.registrationOmr },
      { key: "legalFees", label: "Legal fees", amountOmr: acq.legalOmr },
      { key: "agencyFees", label: "Agency fees", amountOmr: acq.agencyOmr },
      { key: "mortgageFees", label: "Mortgage arrangement fees", amountOmr: acq.mortgageArrangementOmr },
      { key: "valuationFees", label: "Valuation fees", amountOmr: acq.valuationOmr },
      { key: "furnishing", label: "Furnishing", amountOmr: acq.furnishingOmr },
      { key: "renovation", label: "Renovation", amountOmr: acq.renovationOmr },
      { key: "initialMaintenance", label: "Initial maintenance", amountOmr: acq.initialMaintenanceOmr },
      { key: "utilityDeposits", label: "Utility deposits", amountOmr: acq.utilityDepositsOmr },
      { key: "insurance", label: "Insurance (year 1)", amountOmr: acq.insuranceOmr },
      { key: "reservationFee", label: "Reservation fee (non-price)", amountOmr: acq.reservationFeeOmr },
      { key: "other", label: "Other acquisition expenses", amountOmr: acq.otherOmr },
    ].filter((l) => l.amountOmr > 0);

    const objectives: ObjectiveProfile = {
      minGrossYieldPct: unset(obj.minGrossYieldPct),
      minNetYieldPct: unset(obj.minNetYieldPct),
      minCashOnCashPct: unset(obj.minCashOnCashPct),
      minIrrPct: unset(obj.minIrrPct),
      minDscr: unset(obj.minDscr),
      maxLtvPct: unset(obj.maxLtvPct),
      maxPaybackYears: unset(obj.maxPaybackYears),
      minMonthlyCashFlowOmr: obj.requirePositiveCashFlow
        ? Math.max(0, obj.minMonthlyCashFlowOmr)
        : unset(obj.minMonthlyCashFlowOmr),
      maxInitialCashOmr: unset(obj.maxInitialCashOmr),
      minAppreciationCagrPct: unset(obj.minAppreciationCagrPct),
      requiredResidencyTier: obj.requiredResidencyTier || undefined,
      requiredCompletion: obj.requiredCompletion === "any" ? undefined : obj.requiredCompletion,
    };

    const verified = prop.prefilledFrom !== "";
    const src = verified ? `Live inventory ${prop.prefilledFrom}` : "Manual entry";
    const tf = (key: string, label: string, value: number | string | null, v: boolean): SourcedValue => ({
      key,
      label,
      value,
      provenance: value == null || value === 0 || value === "" ? "missing" : v ? "verified" : "assumed",
      source: src,
    });
    const trackedFields: SourcedValue[] = [
      tf("askingPriceOmr", "Asking price", prop.askingPriceOmr, verified),
      tf("areaSqm", "Built-up area", prop.areaSqm, verified),
      tf("project", "Project", prop.project, verified),
      tf("developer", "Developer", prop.developer, verified),
      tf("negotiatedPriceOmr", "Negotiated price", prop.negotiatedPriceOmr || null, false),
      tf("rentAssumption", "Rental assumptions", daily.enabled || monthly.enabled || annual.enabled ? "entered" : null, false),
      tf("operatingCosts", "Operating cost assumptions", "entered", false),
      tf("growthAssumptions", "Growth / appreciation assumptions", "entered", false),
    ];

    return {
      property: {
        name: prop.name || undefined,
        project: prop.project || undefined,
        developer: prop.developer || undefined,
        reference: prop.reference || undefined,
        unitType: prop.unitType || undefined,
        bedrooms: prop.bedrooms || null,
        bathrooms: prop.bathrooms || null,
        areaSqm: prop.areaSqm,
        landAreaSqm: prop.landAreaSqm || null,
        floor: prop.floor || undefined,
        completionStatus: prop.completionStatus,
        handoverMonths: prop.completionStatus === "off_plan" ? prop.handoverMonths : undefined,
        furnishing: prop.furnishing,
        location: prop.location || undefined,
        latitude: prop.latitude || null,
        longitude: prop.longitude || null,
        category: prop.category,
        ownershipEligibility: prop.category === "ITC" ? "all_nationalities" : "gcc_omani_only",
        askingPriceOmr: prop.askingPriceOmr,
        negotiatedPriceOmr: prop.negotiatedPriceOmr || null,
        marketValueOmr: prop.marketValueOmr || null,
        dataSource: src,
      },
      acquisition: { costLines, contingencyPct: acq.contingencyPct },
      strategies: {
        daily: daily.enabled ? stripEnabled(daily) : undefined,
        monthly: monthly.enabled ? stripEnabled(monthly) : undefined,
        annual: annual.enabled ? stripEnabled(annual) : undefined,
        blendSharesPct:
          active === "blended" ? { daily: blendDaily, annual: blendAnnual } : undefined,
      },
      activeStrategy: active,
      financing:
        fin.mode === "mortgage"
          ? {
              mode: "mortgage",
              ltvPct: fin.ltvPct,
              annualRatePct: fin.annualRatePct,
              termYears: fin.termYears,
              paymentsPerYear: fin.paymentsPerYear,
              graceMonths: fin.graceMonths,
              interestOnlyMonths: fin.interestOnlyMonths,
              balloonOmr: fin.balloonOmr,
              mortgageFeesOmr: fin.mortgageFeesOmr,
            }
          : fin.mode === "payment_plan"
            ? {
                mode: "payment_plan",
                plan: {
                  // UI whole percents → calculators FRACTIONS at this boundary.
                  reservationPct: fin.planReservationPct / 100,
                  downPct: fin.planDownPct / 100,
                  years: fin.planYears,
                  installmentsPerYear: fin.planPerYear,
                },
              }
            : { mode: "cash" },
      projection: {
        holdYears: proj.holdYears,
        rentEscalationPct: proj.rentEscalationPct,
        expenseInflationPct: proj.expenseInflationPct,
        appreciationPct: proj.appreciationPct,
        exitCapRatePct: proj.exitCapRatePct > 0 ? proj.exitCapRatePct : undefined,
        sellingCostsPct: proj.sellingCostsPct,
        discountRatePct: proj.discountRatePct,
        rentalStartDelayMonths: proj.rentalStartDelayMonths,
      },
      objectives,
      comparables: comparables.length > 0 ? comparables : undefined,
      trackedFields,
    };
  }, [prop, acq, daily, monthly, annual, active, blendDaily, blendAnnual, fin, proj, obj, comparables]);

  // Debounce the full analysis (solver + scenarios + sensitivity are heavier
  // than a keystroke should trigger).
  const [result, setResult] = useState<InvestmentAnalysisResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (engineInput.property.askingPriceOmr <= 0) {
      setResult(null);
      return;
    }
    timer.current = setTimeout(() => {
      try {
        setResult(runInvestmentAnalysis(engineInput));
      } catch {
        setResult(null);
      }
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [engineInput]);

  // -------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------
  async function save(asCopy = false) {
    setSaveState("saving");
    setSaveDetail("");
    try {
      const res = await fetch("/api/invest/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: asCopy ? undefined : (savedId ?? undefined),
          title: (asCopy ? `${title} (copy)` : title) || `${prop.reference || "Manual"} analysis`,
          status: "saved",
          input: engineInput,
        }),
      });
      const j = await res.json();
      if (j.setup) {
        setSaveState("setup");
      } else if (j.saved) {
        setSavedId(j.saved.id);
        if (asCopy) setTitle(j.saved.title);
        setSaveState("saved");
        setHistory(null); // refresh on next open
      } else {
        setSaveState("error");
        setSaveDetail(j.detail ?? j.error ?? "Save failed");
      }
    } catch {
      setSaveState("error");
      setSaveDetail("Network error");
    }
  }

  async function openHistory() {
    setShowHistory((s) => !s);
    if (history) return;
    try {
      const res = await fetch("/api/invest/analyses");
      const j = await res.json();
      setHistory(j.analyses ?? []);
    } catch {
      setHistory([]);
    }
  }

  async function loadAnalysis(id: string) {
    try {
      const res = await fetch(`/api/invest/analyses/${id}`);
      const j = await res.json();
      if (!j.analysis) return;
      const input = j.analysis.input as InvestmentAnalysisInput;
      hydrateFromInput(input);
      setSavedId(j.analysis.id);
      setTitle(j.analysis.title);
      setShowHistory(false);
      setSaveState("idle");
    } catch {
      /* leave state untouched on failure */
    }
  }

  /** Reverse-map a saved engine input into the UI state (best-effort, typed). */
  function hydrateFromInput(input: InvestmentAnalysisInput) {
    const p = input.property;
    setProp({
      ...EMPTY_PROP,
      name: p.name ?? "",
      project: p.project ?? "",
      developer: p.developer ?? "",
      reference: p.reference ?? "",
      unitType: p.unitType ?? "",
      bedrooms: p.bedrooms ?? 0,
      bathrooms: p.bathrooms ?? 0,
      areaSqm: p.areaSqm,
      landAreaSqm: p.landAreaSqm ?? 0,
      floor: p.floor ?? "",
      completionStatus: p.completionStatus,
      handoverMonths: p.handoverMonths ?? 0,
      furnishing: p.furnishing ?? "unknown",
      location: p.location ?? "",
      latitude: p.latitude ?? 0,
      longitude: p.longitude ?? 0,
      category: p.category ?? "ITC",
      askingPriceOmr: p.askingPriceOmr,
      negotiatedPriceOmr: p.negotiatedPriceOmr ?? 0,
      marketValueOmr: p.marketValueOmr ?? 0,
      prefilledFrom: p.dataSource?.startsWith("Live inventory") ? (p.reference ?? "") : "",
    });
    const lines = Object.fromEntries(input.acquisition.costLines.map((l) => [l.key, l.amountOmr]));
    setAcq({
      registrationOmr: lines.registrationFee ?? 0,
      legalOmr: lines.legalFees ?? 0,
      agencyOmr: lines.agencyFees ?? 0,
      mortgageArrangementOmr: lines.mortgageFees ?? 0,
      valuationOmr: lines.valuationFees ?? 0,
      furnishingOmr: lines.furnishing ?? 0,
      renovationOmr: lines.renovation ?? 0,
      initialMaintenanceOmr: lines.initialMaintenance ?? 0,
      utilityDepositsOmr: lines.utilityDeposits ?? 0,
      insuranceOmr: lines.insurance ?? 0,
      reservationFeeOmr: lines.reservationFee ?? 0,
      otherOmr: lines.other ?? 0,
      contingencyPct: input.acquisition.contingencyPct ?? 0,
    });
    if (input.strategies.daily) setDaily((d) => ({ ...d, ...input.strategies.daily, enabled: true }));
    else setDaily((d) => ({ ...d, enabled: false }));
    if (input.strategies.monthly) setMonthly((m) => ({ ...m, ...input.strategies.monthly, enabled: true }));
    else setMonthly((m) => ({ ...m, enabled: false }));
    if (input.strategies.annual) setAnnual((a) => ({ ...a, ...input.strategies.annual, enabled: true }));
    else setAnnual((a) => ({ ...a, enabled: false }));
    setActive(input.activeStrategy);
    if (input.strategies.blendSharesPct) {
      setBlendDaily(input.strategies.blendSharesPct.daily ?? 0);
      setBlendAnnual(input.strategies.blendSharesPct.annual ?? 0);
    }
    const f = input.financing;
    setFin((old) => ({
      ...old,
      mode: f.mode,
      ltvPct: f.ltvPct ?? old.ltvPct,
      annualRatePct: f.annualRatePct ?? old.annualRatePct,
      termYears: f.termYears ?? old.termYears,
      paymentsPerYear: f.paymentsPerYear ?? old.paymentsPerYear,
      graceMonths: f.graceMonths ?? 0,
      interestOnlyMonths: f.interestOnlyMonths ?? 0,
      balloonOmr: f.balloonOmr ?? 0,
      mortgageFeesOmr: f.mortgageFeesOmr ?? 0,
      planReservationPct: f.plan?.reservationPct != null ? f.plan.reservationPct * 100 : old.planReservationPct,
      planDownPct: f.plan?.downPct != null ? f.plan.downPct * 100 : old.planDownPct,
      planYears: f.plan?.years ?? old.planYears,
      planPerYear: f.plan?.installmentsPerYear ?? old.planPerYear,
    }));
    const pr = input.projection;
    setProj({
      holdYears: pr.holdYears,
      rentEscalationPct: pr.rentEscalationPct ?? 0,
      expenseInflationPct: pr.expenseInflationPct ?? 0,
      appreciationPct: pr.appreciationPct ?? 0,
      exitCapRatePct: pr.exitCapRatePct ?? 0,
      sellingCostsPct: pr.sellingCostsPct ?? 0,
      discountRatePct: pr.discountRatePct ?? 8,
      rentalStartDelayMonths: pr.rentalStartDelayMonths ?? 0,
    });
    const o = input.objectives ?? {};
    setObj({
      minGrossYieldPct: o.minGrossYieldPct ?? 0,
      minNetYieldPct: o.minNetYieldPct ?? 0,
      minCashOnCashPct: o.minCashOnCashPct ?? 0,
      minIrrPct: o.minIrrPct ?? 0,
      minDscr: o.minDscr ?? 0,
      maxLtvPct: o.maxLtvPct ?? 0,
      maxPaybackYears: o.maxPaybackYears ?? 0,
      minMonthlyCashFlowOmr: o.minMonthlyCashFlowOmr ?? 0,
      requirePositiveCashFlow: o.minMonthlyCashFlowOmr === 0,
      maxInitialCashOmr: o.maxInitialCashOmr ?? 0,
      minAppreciationCagrPct: o.minAppreciationCagrPct ?? 0,
      requiredResidencyTier: o.requiredResidencyTier ?? "",
      requiredCompletion: o.requiredCompletion ?? "any",
    });
    setComparables(input.comparables ?? []);
  }

  // -------------------------------------------------------------------
  // Transfer to Offer
  // -------------------------------------------------------------------
  function transferToOffer(priceOmr: number) {
    onSendToOffer({
      reference: prop.reference,
      project: prop.project,
      developer: prop.developer,
      unitType: prop.unitType,
      areaSqm: prop.areaSqm,
      priceOmr,
      category: prop.category,
      ownershipEligibility: prop.category === "ITC" ? "all_nationalities" : "gcc_omani_only",
    });
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  const analysisPrice = prop.negotiatedPriceOmr > 0 ? prop.negotiatedPriceOmr : prop.askingPriceOmr;
  const enabledCount = [daily.enabled, monthly.enabled, annual.enabled].filter(Boolean).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <SectionTitle sub="Guided deal analysis — deterministic engine, explainable score, formula-driven offer range. Every projection is an assumption, never a promise.">
          Investment Analysis
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Analysis title"
            className="w-52 rounded-md border border-hairline bg-ink-100 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
            placeholder="Analysis title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saveState === "saving" || !result}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-soft disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            {saveState === "saving" ? "Saving…" : savedId ? "Save (new version)" : "Save analysis"}
          </button>
          {savedId ? (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saveState === "saving"}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs text-white/70 transition hover:border-gold/40 hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </button>
          ) : null}
          <button
            type="button"
            onClick={openHistory}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs text-white/70 transition hover:border-gold/40 hover:text-white"
          >
            <FolderOpen className="h-3.5 w-3.5" /> History
          </button>
        </div>
      </div>

      {saveState === "saved" && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 print:hidden">
          Saved — the server recomputed and stored this analysis{savedId ? ` (id ${savedId.slice(0, 8)}…)` : ""}.
        </p>
      )}
      {saveState === "setup" && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 print:hidden">
          Storage is not configured (no SUPABASE_SERVICE_ROLE_KEY) — the analysis runs fully in-session but cannot be saved.
        </p>
      )}
      {saveState === "error" && (
        <p className="rounded-lg border border-risk/30 bg-risk/10 px-3 py-2 text-xs text-risk print:hidden">
          Save failed: {saveDetail}
        </p>
      )}

      {showHistory && (
        <div className="rounded-2xl border border-hairline bg-ink-100/60 p-4 print:hidden">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold">Saved analyses</p>
          {history == null ? (
            <p className="text-xs text-white/40">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-white/40">Nothing saved yet.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => loadAnalysis(h.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-hairline bg-ink-100/50 px-3 py-2 text-start text-sm text-white/80 transition hover:border-gold/40"
                  >
                    <span className="min-w-0 truncate">
                      {h.title}
                      <span className="ms-2 text-[11px] text-white/40">v{h.analysis_version}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-white/40">
                      {new Date(h.updated_at).toLocaleDateString("en-GB")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] print:hidden">
        {/* ------------- Left: guided inputs ------------- */}
        <div className="space-y-3">
          <StepCard
            step={1}
            title="Property"
            defaultOpen
            summary={
              prop.reference || prop.project
                ? `${prop.reference || "Manual"} · ${prop.project || "—"} · ${formatOMR(prop.askingPriceOmr, true)}`
                : "Pick from live inventory or enter manually"
            }
          >
            <div className="space-y-3">
              <UnitPicker
                units={liveUnits}
                nationality=""
                pickedRefs={prop.prefilledFrom ? [prop.prefilledFrom] : []}
                onPick={applyUnit}
                title="Prefill from live inventory"
                hint="or enter below"
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Reference" value={prop.reference} onChange={(v) => setProp({ ...prop, reference: v, prefilledFrom: "" })} />
                <TextField label="Project" value={prop.project} onChange={(v) => setProp({ ...prop, project: v, prefilledFrom: "" })} />
                <TextField label="Developer" value={prop.developer} onChange={(v) => setProp({ ...prop, developer: v })} />
                <TextField label="Unit type" value={prop.unitType} onChange={(v) => setProp({ ...prop, unitType: v })} />
                <NumberField label="Bedrooms" value={prop.bedrooms} onChange={(v) => setProp({ ...prop, bedrooms: v })} />
                <NumberField label="Bathrooms" value={prop.bathrooms} onChange={(v) => setProp({ ...prop, bathrooms: v })} />
                <NumberField label="Built-up area" suffix="m²" step={5} value={prop.areaSqm} onChange={(v) => setProp({ ...prop, areaSqm: v, prefilledFrom: "" })} />
                <NumberField label="Land area" suffix="m²" step={10} value={prop.landAreaSqm} onChange={(v) => setProp({ ...prop, landAreaSqm: v })} />
                <SelectField
                  label="Completion"
                  value={prop.completionStatus}
                  onChange={(v) => setProp({ ...prop, completionStatus: v as PropState["completionStatus"] })}
                  options={[
                    { value: "ready", label: "Ready / completed" },
                    { value: "off_plan", label: "Off-plan" },
                  ]}
                />
                {prop.completionStatus === "off_plan" ? (
                  <NumberField label="Handover in" suffix="months" value={prop.handoverMonths} onChange={(v) => setProp({ ...prop, handoverMonths: v })} />
                ) : (
                  <SelectField
                    label="Furnishing"
                    value={prop.furnishing}
                    onChange={(v) => setProp({ ...prop, furnishing: v as PropState["furnishing"] })}
                    options={[
                      { value: "unknown", label: "Unknown" },
                      { value: "furnished", label: "Furnished" },
                      { value: "semi_furnished", label: "Semi-furnished" },
                      { value: "unfurnished", label: "Unfurnished" },
                    ]}
                  />
                )}
                <SelectField
                  label="Community"
                  value={prop.category}
                  onChange={(v) => setProp({ ...prop, category: v as PropState["category"] })}
                  options={[
                    { value: "ITC", label: "ITC — all nationalities" },
                    { value: "future_cities", label: "Future Cities — GCC/Omani" },
                    { value: "surooh", label: "Surooh — GCC/Omani" },
                  ]}
                />
                <TextField label="Location / area" value={prop.location} onChange={(v) => setProp({ ...prop, location: v })} />
                <NumberField label="Latitude" step={0.001} value={prop.latitude} onChange={(v) => setProp({ ...prop, latitude: v })} hint="For location signals" />
                <NumberField label="Longitude" step={0.001} value={prop.longitude} onChange={(v) => setProp({ ...prop, longitude: v })} />
              </div>
              <p className="text-[11px] text-white/35">
                {prop.prefilledFrom
                  ? `Facts prefilled from live inventory (${prop.prefilledFrom}) are marked VERIFIED in the data-quality score.`
                  : "Manually entered facts are marked ASSUMED until verified against a record."}
              </p>
            </div>
          </StepCard>

          <StepCard
            step={2}
            title="Purchase & acquisition costs"
            summary={`Asking ${formatOMR(prop.askingPriceOmr, true)}${prop.negotiatedPriceOmr > 0 ? ` · analysing at ${formatOMR(prop.negotiatedPriceOmr, true)}` : ""}`}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumberField label="Asking price" suffix="OMR" step={1000} value={prop.askingPriceOmr} onChange={(v) => setProp({ ...prop, askingPriceOmr: v, prefilledFrom: "" })} />
                <NumberField label="Negotiated price" suffix="OMR" step={1000} value={prop.negotiatedPriceOmr} onChange={(v) => setProp({ ...prop, negotiatedPriceOmr: v })} hint="0 = analyse at asking" />
                <NumberField label="Market value est." suffix="OMR" step={1000} value={prop.marketValueOmr} onChange={(v) => setProp({ ...prop, marketValueOmr: v })} hint="Cap rate basis (optional)" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-white/45">One-off costs</p>
                <button
                  type="button"
                  onClick={applyStandardCosts}
                  className="rounded-full border border-hairline px-3 py-1 text-[11px] text-white/60 transition hover:border-gold/40 hover:text-white"
                >
                  Apply standard Oman assumptions
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumberField label="Registration" suffix="OMR" step={100} value={acq.registrationOmr} onChange={(v) => setAcq({ ...acq, registrationOmr: v })} />
                <NumberField label="Legal" suffix="OMR" step={100} value={acq.legalOmr} onChange={(v) => setAcq({ ...acq, legalOmr: v })} />
                <NumberField label="Agency" suffix="OMR" step={100} value={acq.agencyOmr} onChange={(v) => setAcq({ ...acq, agencyOmr: v })} />
                <NumberField label="Mortgage fees" suffix="OMR" step={100} value={acq.mortgageArrangementOmr} onChange={(v) => setAcq({ ...acq, mortgageArrangementOmr: v })} />
                <NumberField label="Valuation" suffix="OMR" step={50} value={acq.valuationOmr} onChange={(v) => setAcq({ ...acq, valuationOmr: v })} />
                <NumberField label="Furnishing" suffix="OMR" step={500} value={acq.furnishingOmr} onChange={(v) => setAcq({ ...acq, furnishingOmr: v })} />
                <NumberField label="Renovation" suffix="OMR" step={500} value={acq.renovationOmr} onChange={(v) => setAcq({ ...acq, renovationOmr: v })} />
                <NumberField label="Initial maintenance" suffix="OMR" step={100} value={acq.initialMaintenanceOmr} onChange={(v) => setAcq({ ...acq, initialMaintenanceOmr: v })} />
                <NumberField label="Utility deposits" suffix="OMR" step={50} value={acq.utilityDepositsOmr} onChange={(v) => setAcq({ ...acq, utilityDepositsOmr: v })} />
                <NumberField label="Insurance (yr 1)" suffix="OMR" step={50} value={acq.insuranceOmr} onChange={(v) => setAcq({ ...acq, insuranceOmr: v })} />
                <NumberField label="Reservation fee" suffix="OMR" step={100} value={acq.reservationFeeOmr} onChange={(v) => setAcq({ ...acq, reservationFeeOmr: v })} hint="Non-price fee only" />
                <NumberField label="Other" suffix="OMR" step={100} value={acq.otherOmr} onChange={(v) => setAcq({ ...acq, otherOmr: v })} />
                <NumberField label="Contingency" suffix="%" step={1} value={acq.contingencyPct} onChange={(v) => setAcq({ ...acq, contingencyPct: v })} hint="% of the costs above" />
              </div>
              <p className="text-[11px] text-white/35">
                Standard assumptions carry their source and effective date (see the report&apos;s assumptions register) — confirm per deal; government fees change.
              </p>
            </div>
          </StepCard>

          <StepCard
            step={3}
            title="Rental strategies"
            summary={`${[daily.enabled && "daily", monthly.enabled && "monthly", annual.enabled && "annual"].filter(Boolean).join(" + ") || "none"} · active: ${active}`}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                <ToggleChip label="Daily / short-let" active={daily.enabled} onClick={() => setDaily({ ...daily, enabled: !daily.enabled })} />
                <ToggleChip label="Monthly" active={monthly.enabled} onClick={() => setMonthly({ ...monthly, enabled: !monthly.enabled })} />
                <ToggleChip label="Annual" active={annual.enabled} onClick={() => setAnnual({ ...annual, enabled: !annual.enabled })} />
              </div>

              {daily.enabled && (
                <fieldset className="space-y-3 rounded-xl border border-hairline p-3">
                  <legend className="px-1 text-xs font-semibold text-gold">Daily / short-term</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <NumberField label="Avg daily rate" suffix="OMR" value={daily.adrOmr} onChange={(v) => setDaily({ ...daily, adrOmr: v })} />
                    <NumberField label="Occupancy" suffix="%" value={daily.occupancyPct} onChange={(v) => setDaily({ ...daily, occupancyPct: v })} />
                    <NumberField label="Owner-blocked" suffix="nights" value={daily.ownerBlockedNights} onChange={(v) => setDaily({ ...daily, ownerBlockedNights: v })} />
                    <NumberField label="Avg stay" suffix="nights" value={daily.averageStayNights} onChange={(v) => setDaily({ ...daily, averageStayNights: v })} />
                    <NumberField label="Cleaning fee" suffix="OMR" value={daily.cleaningFeeOmr} onChange={(v) => setDaily({ ...daily, cleaningFeeOmr: v })} hint="Charged / stay" />
                    <NumberField label="Cleaning cost" suffix="OMR" value={daily.cleaningCostOmr} onChange={(v) => setDaily({ ...daily, cleaningCostOmr: v })} hint="Paid / stay" />
                    <NumberField label="Platform fee" suffix="%" value={daily.platformFeePct} onChange={(v) => setDaily({ ...daily, platformFeePct: v })} />
                    <NumberField label="Payment fee" suffix="%" value={daily.paymentFeePct} onChange={(v) => setDaily({ ...daily, paymentFeePct: v })} />
                    <NumberField label="Tourism fee" suffix="%" value={daily.tourismFeePct} onChange={(v) => setDaily({ ...daily, tourismFeePct: v })} />
                    <NumberField label="Management" suffix="%" value={daily.managementFeePct} onChange={(v) => setDaily({ ...daily, managementFeePct: v })} hint="% of EGI" />
                    <NumberField label="Utilities / yr" suffix="OMR" step={50} value={daily.utilitiesOmr} onChange={(v) => setDaily({ ...daily, utilitiesOmr: v })} />
                    <NumberField label="Internet / yr" suffix="OMR" step={20} value={daily.internetOmr} onChange={(v) => setDaily({ ...daily, internetOmr: v })} />
                    <NumberField label="Consumables / yr" suffix="OMR" step={20} value={daily.consumablesOmr} onChange={(v) => setDaily({ ...daily, consumablesOmr: v })} />
                    <NumberField label="Linen & housekeeping" suffix="OMR" step={50} value={daily.linenHousekeepingOmr} onChange={(v) => setDaily({ ...daily, linenHousekeepingOmr: v })} />
                    <NumberField label="Maintenance / yr" suffix="OMR" step={50} value={daily.maintenanceOmr} onChange={(v) => setDaily({ ...daily, maintenanceOmr: v })} />
                    <NumberField label="Reserve / yr" suffix="OMR" step={50} value={daily.replacementReserveOmr} onChange={(v) => setDaily({ ...daily, replacementReserveOmr: v })} />
                    <NumberField label="Service charge / yr" suffix="OMR" step={50} value={daily.serviceChargeOmr} onChange={(v) => setDaily({ ...daily, serviceChargeOmr: v })} />
                    <NumberField label="Insurance / yr" suffix="OMR" step={50} value={daily.insuranceOmr} onChange={(v) => setDaily({ ...daily, insuranceOmr: v })} />
                    <NumberField label="Other / yr" suffix="OMR" step={50} value={daily.otherExpensesOmr} onChange={(v) => setDaily({ ...daily, otherExpensesOmr: v })} />
                  </div>
                </fieldset>
              )}

              {monthly.enabled && (
                <fieldset className="space-y-3 rounded-xl border border-hairline p-3">
                  <legend className="px-1 text-xs font-semibold text-gold">Monthly / medium-term</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <NumberField label="Monthly rent" suffix="OMR" step={25} value={monthly.monthlyRentOmr} onChange={(v) => setMonthly({ ...monthly, monthlyRentOmr: v })} />
                    <NumberField label="Vacancy" suffix="%" value={monthly.vacancyPct} onChange={(v) => setMonthly({ ...monthly, vacancyPct: v })} />
                    <NumberField label="Lease-up" suffix="months" value={monthly.leaseUpMonths} onChange={(v) => setMonthly({ ...monthly, leaseUpMonths: v })} />
                    <NumberField label="Rent-free" suffix="months" value={monthly.rentFreeMonths} onChange={(v) => setMonthly({ ...monthly, rentFreeMonths: v })} />
                    <NumberField label="Management" suffix="%" value={monthly.managementFeePct} onChange={(v) => setMonthly({ ...monthly, managementFeePct: v })} />
                    <NumberField label="Owner utilities / yr" suffix="OMR" step={50} value={monthly.utilitiesOmr} onChange={(v) => setMonthly({ ...monthly, utilitiesOmr: v })} />
                    <NumberField label="Maintenance / yr" suffix="OMR" step={50} value={monthly.maintenanceOmr} onChange={(v) => setMonthly({ ...monthly, maintenanceOmr: v })} />
                    <NumberField label="Service charge / yr" suffix="OMR" step={50} value={monthly.serviceChargeOmr} onChange={(v) => setMonthly({ ...monthly, serviceChargeOmr: v })} />
                    <NumberField label="Insurance / yr" suffix="OMR" step={50} value={monthly.insuranceOmr} onChange={(v) => setMonthly({ ...monthly, insuranceOmr: v })} />
                    <NumberField label="Reserve / yr" suffix="OMR" step={50} value={monthly.replacementReserveOmr} onChange={(v) => setMonthly({ ...monthly, replacementReserveOmr: v })} />
                    <NumberField label="Other / yr" suffix="OMR" step={50} value={monthly.otherExpensesOmr} onChange={(v) => setMonthly({ ...monthly, otherExpensesOmr: v })} />
                  </div>
                </fieldset>
              )}

              {annual.enabled && (
                <fieldset className="space-y-3 rounded-xl border border-hairline p-3">
                  <legend className="px-1 text-xs font-semibold text-gold">Annual / long-term</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <NumberField label="Annual rent" suffix="OMR" step={100} value={annual.annualRentOmr} onChange={(v) => setAnnual({ ...annual, annualRentOmr: v })} />
                    <NumberField label="Vacancy allowance" suffix="%" value={annual.vacancyAllowancePct} onChange={(v) => setAnnual({ ...annual, vacancyAllowancePct: v })} />
                    <NumberField label="Leasing commission" suffix="%" value={annual.leasingCommissionPct} onChange={(v) => setAnnual({ ...annual, leasingCommissionPct: v })} />
                    <NumberField label="Renewal costs / yr" suffix="OMR" step={50} value={annual.renewalCostsOmr} onChange={(v) => setAnnual({ ...annual, renewalCostsOmr: v })} />
                    <NumberField label="Management" suffix="%" value={annual.managementFeePct} onChange={(v) => setAnnual({ ...annual, managementFeePct: v })} />
                    <NumberField label="Service charge / yr" suffix="OMR" step={50} value={annual.serviceChargeOmr} onChange={(v) => setAnnual({ ...annual, serviceChargeOmr: v })} />
                    <NumberField label="Insurance / yr" suffix="OMR" step={50} value={annual.insuranceOmr} onChange={(v) => setAnnual({ ...annual, insuranceOmr: v })} />
                    <NumberField label="Maintenance / yr" suffix="OMR" step={50} value={annual.maintenanceOmr} onChange={(v) => setAnnual({ ...annual, maintenanceOmr: v })} />
                    <NumberField label="Reserve / yr" suffix="OMR" step={50} value={annual.replacementReserveOmr} onChange={(v) => setAnnual({ ...annual, replacementReserveOmr: v })} />
                    <NumberField label="Other / yr" suffix="OMR" step={50} value={annual.otherExpensesOmr} onChange={(v) => setAnnual({ ...annual, otherExpensesOmr: v })} />
                  </div>
                </fieldset>
              )}

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-white/45">Strategy driving the projection</p>
                <div className="flex flex-wrap gap-1.5">
                  {daily.enabled && <ToggleChip label="Daily" active={active === "daily"} onClick={() => setActive("daily")} />}
                  {monthly.enabled && <ToggleChip label="Monthly" active={active === "monthly"} onClick={() => setActive("monthly")} />}
                  {annual.enabled && <ToggleChip label="Annual" active={active === "annual"} onClick={() => setActive("annual")} />}
                  {daily.enabled && annual.enabled && (
                    <ToggleChip label="Blended" active={active === "blended"} onClick={() => setActive("blended")} />
                  )}
                </div>
                {active === "blended" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <NumberField label="Daily share" suffix="%" value={blendDaily} onChange={setBlendDaily} />
                    <NumberField label="Annual share" suffix="%" value={blendAnnual} onChange={setBlendAnnual} />
                  </div>
                )}
                {enabledCount === 0 && (
                  <p className="mt-2 text-[11px] text-amber-300/80">Enable at least one strategy — income is zero until then.</p>
                )}
              </div>
            </div>
          </StepCard>

          <StepCard
            step={4}
            title="Financing"
            summary={
              fin.mode === "cash"
                ? "All cash"
                : fin.mode === "mortgage"
                  ? `Mortgage · ${fin.ltvPct}% LTV · ${fin.annualRatePct}% · ${fin.termYears}y`
                  : `Developer plan · ${fin.planReservationPct}% + ${fin.planDownPct}% + ${fin.planYears}y`
            }
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <ToggleChip label="Cash" active={fin.mode === "cash"} onClick={() => setFin({ ...fin, mode: "cash" })} />
                <ToggleChip label="Mortgage" active={fin.mode === "mortgage"} onClick={() => setFin({ ...fin, mode: "mortgage" })} />
                {prop.completionStatus === "off_plan" && (
                  <ToggleChip label="Developer plan" active={fin.mode === "payment_plan"} onClick={() => setFin({ ...fin, mode: "payment_plan" })} />
                )}
              </div>
              {fin.mode === "mortgage" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="LTV" suffix="%" value={fin.ltvPct} onChange={(v) => setFin({ ...fin, ltvPct: v })} hint={analysisPrice > 0 ? `Loan ≈ ${formatOMR((analysisPrice * fin.ltvPct) / 100, true)}` : undefined} />
                  <NumberField label="Rate" suffix="%" step={0.25} value={fin.annualRatePct} onChange={(v) => setFin({ ...fin, annualRatePct: v })} />
                  <NumberField label="Term" suffix="yr" value={fin.termYears} onChange={(v) => setFin({ ...fin, termYears: v })} />
                  <SelectField
                    label="Frequency"
                    value={String(fin.paymentsPerYear)}
                    onChange={(v) => setFin({ ...fin, paymentsPerYear: Number(v) === 4 ? 4 : 12 })}
                    options={[
                      { value: "12", label: "Monthly" },
                      { value: "4", label: "Quarterly" },
                    ]}
                  />
                  <NumberField label="Grace" suffix="months" value={fin.graceMonths} onChange={(v) => setFin({ ...fin, graceMonths: v })} />
                  <NumberField label="Interest-only" suffix="months" value={fin.interestOnlyMonths} onChange={(v) => setFin({ ...fin, interestOnlyMonths: v })} />
                  <NumberField label="Balloon" suffix="OMR" step={1000} value={fin.balloonOmr} onChange={(v) => setFin({ ...fin, balloonOmr: v })} />
                  <NumberField label="Lender fees" suffix="OMR" step={100} value={fin.mortgageFeesOmr} onChange={(v) => setFin({ ...fin, mortgageFeesOmr: v })} />
                </div>
              )}
              {fin.mode === "payment_plan" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <NumberField label="Reservation" suffix="%" value={fin.planReservationPct} onChange={(v) => setFin({ ...fin, planReservationPct: v })} />
                  <NumberField label="Down payment" suffix="%" value={fin.planDownPct} onChange={(v) => setFin({ ...fin, planDownPct: v })} />
                  <NumberField label="Years" suffix="yr" value={fin.planYears} onChange={(v) => setFin({ ...fin, planYears: v })} />
                  <NumberField label="Instalments / yr" value={fin.planPerYear} onChange={(v) => setFin({ ...fin, planPerYear: v })} />
                </div>
              )}
            </div>
          </StepCard>

          <StepCard
            step={5}
            title="Hold, exit & objectives"
            summary={`${proj.holdYears}y hold · ${proj.appreciationPct}% growth · ${Object.values(obj).filter((v) => typeof v === "number" && v > 0).length} objectives set`}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField label="Hold" suffix="yr" min={1} max={30} value={proj.holdYears} onChange={(v) => setProj({ ...proj, holdYears: v })} />
                <NumberField label="Rent escalation" suffix="%/yr" step={0.5} value={proj.rentEscalationPct} onChange={(v) => setProj({ ...proj, rentEscalationPct: v })} />
                <NumberField label="Expense inflation" suffix="%/yr" step={0.5} value={proj.expenseInflationPct} onChange={(v) => setProj({ ...proj, expenseInflationPct: v })} />
                <NumberField label="Appreciation" suffix="%/yr" step={0.5} value={proj.appreciationPct} onChange={(v) => setProj({ ...proj, appreciationPct: v })} />
                <NumberField label="Exit cap rate" suffix="%" step={0.5} value={proj.exitCapRatePct} onChange={(v) => setProj({ ...proj, exitCapRatePct: v })} hint="0 = exit at appreciated value" />
                <NumberField label="Selling costs" suffix="%" step={0.5} value={proj.sellingCostsPct} onChange={(v) => setProj({ ...proj, sellingCostsPct: v })} />
                <NumberField label="Discount rate" suffix="%" step={0.5} value={proj.discountRatePct} onChange={(v) => setProj({ ...proj, discountRatePct: v })} hint="For NPV" />
                <NumberField label="Rental delay" suffix="months" value={proj.rentalStartDelayMonths} onChange={(v) => setProj({ ...proj, rentalStartDelayMonths: v })} hint="After handover" />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-white/45">
                  Investment objectives — leave 0 to skip a criterion
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <NumberField label="Min gross yield" suffix="%" step={0.5} value={obj.minGrossYieldPct} onChange={(v) => setObj({ ...obj, minGrossYieldPct: v })} />
                  <NumberField label="Min net yield" suffix="%" step={0.5} value={obj.minNetYieldPct} onChange={(v) => setObj({ ...obj, minNetYieldPct: v })} />
                  <NumberField label="Min cash-on-cash" suffix="%" step={0.5} value={obj.minCashOnCashPct} onChange={(v) => setObj({ ...obj, minCashOnCashPct: v })} />
                  <NumberField label="Min IRR" suffix="%" step={0.5} value={obj.minIrrPct} onChange={(v) => setObj({ ...obj, minIrrPct: v })} />
                  <NumberField label="Min DSCR" step={0.05} value={obj.minDscr} onChange={(v) => setObj({ ...obj, minDscr: v })} />
                  <NumberField label="Max LTV" suffix="%" value={obj.maxLtvPct} onChange={(v) => setObj({ ...obj, maxLtvPct: v })} />
                  <NumberField label="Max payback" suffix="yr" value={obj.maxPaybackYears} onChange={(v) => setObj({ ...obj, maxPaybackYears: v })} />
                  <NumberField label="Min monthly cash flow" suffix="OMR" step={25} value={obj.minMonthlyCashFlowOmr} onChange={(v) => setObj({ ...obj, minMonthlyCashFlowOmr: v })} />
                  <NumberField label="Max initial cash" suffix="OMR" step={1000} value={obj.maxInitialCashOmr} onChange={(v) => setObj({ ...obj, maxInitialCashOmr: v })} />
                  <NumberField label="Min value CAGR" suffix="%" step={0.5} value={obj.minAppreciationCagrPct} onChange={(v) => setObj({ ...obj, minAppreciationCagrPct: v })} />
                  <SelectField
                    label="Residency required"
                    value={obj.requiredResidencyTier}
                    onChange={(v) => setObj({ ...obj, requiredResidencyTier: v as ObjState["requiredResidencyTier"] })}
                    options={[
                      { value: "", label: "Not required" },
                      { value: "investor_2yr", label: "2-yr Investor" },
                      { value: "golden_10yr", label: "10-yr Golden" },
                    ]}
                  />
                  <SelectField
                    label="Completion required"
                    value={obj.requiredCompletion}
                    onChange={(v) => setObj({ ...obj, requiredCompletion: v as ObjState["requiredCompletion"] })}
                    options={[
                      { value: "any", label: "Any" },
                      { value: "ready", label: "Ready only" },
                      { value: "off_plan", label: "Off-plan only" },
                    ]}
                  />
                </div>
                <div className="mt-2">
                  <ToggleChip
                    label="Require cash flow ≥ 0"
                    active={obj.requirePositiveCashFlow}
                    onClick={() => setObj({ ...obj, requirePositiveCashFlow: !obj.requirePositiveCashFlow })}
                  />
                </div>
              </div>
            </div>
          </StepCard>

          <StepCard step={6} title="Comparables & location" summary={`${comparables.length} comparables`}>
            <ComparablesPanel
              comparables={comparables}
              onChange={setComparables}
              subject={{ lat: prop.latitude || null, lng: prop.longitude || null }}
            />
          </StepCard>
        </div>

        {/* ------------- Right: results ------------- */}
        <div className="min-w-0">
          {result ? (
            <ResultsPanel
              result={result}
              input={engineInput}
              onTransferToOffer={transferToOffer}
            />
          ) : (
            <div className="grid min-h-[300px] place-items-center rounded-2xl border border-hairline bg-ink-100/40 p-8 text-center">
              <div>
                <TrendingUp className="mx-auto mb-3 h-8 w-8 text-white/25" />
                <p className="text-sm text-white/50">
                  Pick a unit or enter an asking price to start the analysis.
                </p>
                <p className="mt-1 text-xs text-white/35">
                  Figures recompute as you type — every projection is an assumption, not a promise.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ------------- Report (prints as its own sheet) ------------- */}
      {result && (
        <ReportSheet result={result} savedId={savedId} title={title || `${prop.reference || "Manual"} analysis`} />
      )}

      <p className="text-[11px] leading-relaxed text-white/30 print:hidden">
        All figures derive from the entered assumptions via the deterministic engine (formula v{result?.formulaVersion ?? "—"}).
        Yields, cash flows and projections are illustrative assumptions — not guaranteed or forecast returns, and not financial advice.
        Suggested offers are analytical estimates, not market valuations. Residency eligibility is decided by the Royal Oman Police.
        {" "}
        {result ? `Break-even occupancy at the current inputs: ${result.metrics.breakEvenOccupancyPct != null ? pctStr(result.metrics.breakEvenOccupancyPct) : "—"}.` : ""}
      </p>
    </section>
  );
}
