"use client";

import { useState, type ReactNode } from "react";
import {
  grossAndNetYield,
  capitalAppreciation,
  paymentPlan,
  mortgageMonthly,
  residencyTier,
  commissionBreakdown,
  omrToUsd,
  type ResidencyTierName,
} from "../../../domain/realestate/calculators";
import { formatOMR } from "../../lib/format";
import { Card, SectionTitle, Badge, ProgressBar } from "../../components/ui";
import { cn } from "../../lib/cn";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const field =
  "w-full rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white tabular-nums placeholder:text-white/30 focus:border-gold/50 focus:outline-none";

/** Whole-percent formatter — calculator outputs are already percents (6.67 -> "6.67%"). */
const pct = (n: number) => `${n.toFixed(2)}%`;

/** Indicative USD hint for foreign investors (OMR is pegged). */
const usd = (omr: number) => `≈ $${Math.round(omrToUsd(omr)).toLocaleString("en-US")}`;

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          className={field}
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
        {suffix ? <span className="shrink-0 text-sm text-white/40">{suffix}</span> : null}
      </div>
      {hint ? <span className="mt-1 block text-[11px] tabular-nums text-white/35">{hint}</span> : null}
    </label>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-white/45">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums sm:text-lg", accent ? "text-gold" : "text-white")}>
        {value}
      </span>
      {hint ? <span className="text-[11px] tabular-nums text-white/40">{hint}</span> : null}
    </div>
  );
}

function CalcCard({
  title,
  subtitle,
  internal,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  internal?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("rounded-2xl", internal && "ring-1 ring-inset ring-gold/25", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg text-gold">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-white/45">{subtitle}</p> : null}
        </div>
        {internal ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/60">
            <LockIcon /> Internal · owner only
          </span>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

function AssumptionNote() {
  return (
    <p className="mt-3 text-[11px] leading-relaxed text-white/35">
      Illustrative assumption based on the figures entered — not a guaranteed or forecast return.
    </p>
  );
}

// ---------------------------------------------------------------------------
// 1 · Rental yield
// ---------------------------------------------------------------------------

function RentalYieldCalc() {
  const [price, setPrice] = useState(150000);
  const [rent, setRent] = useState(9000);
  const [costs, setCosts] = useState(1500);

  const r = grossAndNetYield({ priceOmr: price, annualRentOmr: rent, annualCostsOmr: costs });

  return (
    <CalcCard title="Rental yield" subtitle="Gross & net return on annual rent">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField label="Purchase price" suffix="OMR" step={1000} value={price} onChange={setPrice} />
        <NumberField label="Annual rent" suffix="OMR" step={100} value={rent} onChange={setRent} />
        <NumberField label="Annual costs" suffix="OMR" step={100} value={costs} onChange={setCosts} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
        <Stat label="Gross yield" value={pct(r.grossYieldPct)} accent />
        <Stat label="Net yield" value={pct(r.netYieldPct)} accent />
        <Stat label="Net annual" value={formatOMR(r.annualNetOmr)} hint={usd(r.annualNetOmr)} />
      </div>
      <AssumptionNote />
    </CalcCard>
  );
}

// ---------------------------------------------------------------------------
// 2 · Capital appreciation
// ---------------------------------------------------------------------------

function CapitalAppreciationCalc() {
  const [price, setPrice] = useState(150000);
  const [growth, setGrowth] = useState(7);
  const [years, setYears] = useState(5);

  const r = capitalAppreciation({ priceOmr: price, annualGrowthPct: growth, years });

  return (
    <CalcCard title="Capital appreciation" subtitle="Projected value from assumed growth">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField label="Purchase price" suffix="OMR" step={1000} value={price} onChange={setPrice} />
        <NumberField label="Annual growth" suffix="%" step={0.5} value={growth} onChange={setGrowth} />
        <NumberField label="Years held" suffix="yr" step={1} min={1} value={years} onChange={setYears} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
        <Stat label="Projected value" value={formatOMR(r.projectedValueOmr)} hint={usd(r.projectedValueOmr)} accent />
        <Stat label="Total gain" value={formatOMR(r.totalGainOmr)} hint={usd(r.totalGainOmr)} />
        <Stat label="CAGR" value={pct(r.cagrPct)} />
      </div>
      <AssumptionNote />
    </CalcCard>
  );
}

// ---------------------------------------------------------------------------
// 3 · Payment plan
// ---------------------------------------------------------------------------

function PaymentPlanCalc() {
  const [price, setPrice] = useState(150000);
  const [downPctInput, setDownPctInput] = useState(15); // whole percent in the UI
  const [years, setYears] = useState(5);
  const [perYear, setPerYear] = useState(4);
  const [reservation, setReservation] = useState(5000);

  // NOTE: paymentPlan.downPct is a FRACTION (0.15 = 15%), so divide the UI percent by 100.
  const r = paymentPlan({
    priceOmr: price,
    downPct: downPctInput / 100,
    years,
    installmentsPerYear: perYear,
    reservationOmr: reservation,
  });

  return (
    <CalcCard
      title="Payment plan"
      subtitle="Reservation, down payment & instalment schedule"
      className="lg:col-span-2"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <NumberField label="Price" suffix="OMR" step={1000} value={price} onChange={setPrice} />
        <NumberField label="Down payment" suffix="%" step={1} value={downPctInput} onChange={setDownPctInput} />
        <NumberField label="Years" suffix="yr" step={1} min={1} value={years} onChange={setYears} />
        <NumberField label="Instalments / yr" step={1} min={1} value={perYear} onChange={setPerYear} />
        <NumberField label="Reservation" suffix="OMR" step={500} value={reservation} onChange={setReservation} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4 sm:grid-cols-4">
        <Stat label="Reservation" value={formatOMR(r.reservationOmr)} />
        <Stat label="Down payment" value={formatOMR(r.downOmr)} accent />
        <Stat label="Balance financed" value={formatOMR(r.balanceOmr)} />
        <Stat label={`Instalment × ${r.installmentsCount}`} value={formatOMR(r.installmentOmr)} accent />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-hairline">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-50 text-[11px] uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Payment</th>
                <th className="px-3 py-2 text-right font-medium">Due</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {r.schedule.map((s, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="px-3 py-1.5 text-white/80">{s.label}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-white/50">
                    {s.dueMonthsFromNow === 0 ? "On signing" : `+${s.dueMonthsFromNow} mo`}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-white">{formatOMR(s.amountOmr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CalcCard>
  );
}

// ---------------------------------------------------------------------------
// 4 · Mortgage
// ---------------------------------------------------------------------------

function MortgageCalc() {
  const [principal, setPrincipal] = useState(120000);
  const [rate, setRate] = useState(5.5);
  const [years, setYears] = useState(20);

  const r = mortgageMonthly({ principalOmr: principal, annualRatePct: rate, years });

  return (
    <CalcCard title="Mortgage" subtitle="Level monthly repayment (annuity)">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField label="Principal" suffix="OMR" step={1000} value={principal} onChange={setPrincipal} />
        <NumberField label="Interest rate" suffix="%" step={0.25} value={rate} onChange={setRate} />
        <NumberField label="Term" suffix="yr" step={1} min={1} value={years} onChange={setYears} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
        <Stat label="Monthly" value={formatOMR(r.monthlyOmr)} hint={usd(r.monthlyOmr)} accent />
        <Stat label="Total repaid" value={formatOMR(r.totalPaidOmr)} />
        <Stat label="Total interest" value={formatOMR(r.totalInterestOmr)} />
      </div>
    </CalcCard>
  );
}

// ---------------------------------------------------------------------------
// 5 · Residency tier
// ---------------------------------------------------------------------------

const RESIDENCY_MAX = 250000; // scale for the threshold bar
const TIER_META: Record<ResidencyTierName, { label: string; variant: "muted" | "good" | "gold" }> = {
  none: { label: "Below threshold", variant: "muted" },
  investor_2yr: { label: "2-Year Investor Residency", variant: "good" },
  golden_10yr: { label: "10-Year Golden Residency", variant: "gold" },
};

function ResidencyCalc() {
  const [price, setPrice] = useState(200000);

  const r = residencyTier({ priceOmr: price });
  const meta = TIER_META[r.tier];

  return (
    <CalcCard title="Residency tier" subtitle="Investment thresholds for Oman residency">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberField
          label="Investment amount"
          suffix="OMR"
          step={5000}
          value={price}
          onChange={setPrice}
          hint={usd(price)}
        />
        <div className="flex flex-col justify-end">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">Result</span>
          <div>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-hairline pt-4">
        <ProgressBar value={price / RESIDENCY_MAX} markers={[50000 / RESIDENCY_MAX, 200000 / RESIDENCY_MAX]} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div
            className={cn(
              "rounded-lg border px-2.5 py-1.5",
              price >= 50000 ? "border-gold/40 text-white/80" : "border-hairline text-white/40",
            )}
          >
            <span className="font-semibold tabular-nums">≥ 50,000 OMR</span> · 2-yr Investor
          </div>
          <div
            className={cn(
              "rounded-lg border px-2.5 py-1.5",
              price >= 200000 ? "border-gold/40 text-white/80" : "border-hairline text-white/40",
            )}
          >
            <span className="font-semibold tabular-nums">≥ 200,000 OMR</span> · 10-yr Golden
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/45">{r.note}</p>
    </CalcCard>
  );
}

// ---------------------------------------------------------------------------
// 6 · Commission split (INTERNAL — never shown to a client)
// ---------------------------------------------------------------------------

function CommissionCalc() {
  const [value, setValue] = useState(150000);
  const [devRate, setDevRate] = useState(3.5);
  const [split, setSplit] = useState(50);

  const r = commissionBreakdown({ propertyValueOmr: value, developerRatePct: devRate, agentSplitPct: split });

  return (
    <CalcCard title="Commission split" subtitle="Developer commission & agent share" internal>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField label="Property value" suffix="OMR" step={1000} value={value} onChange={setValue} />
        <NumberField label="Developer rate" suffix="%" step={0.25} value={devRate} onChange={setDevRate} />
        <NumberField label="Agent split" suffix="%" step={5} value={split} onChange={setSplit} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
        <Stat label="Alwalaa gross" value={formatOMR(r.alwalaaGrossOmr)} />
        <Stat label="Agent share" value={formatOMR(r.agentShareOmr)} />
        <Stat label="Alwalaa net" value={formatOMR(r.alwalaaNetOmr)} accent />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
        <LockIcon /> Confidential split — never shown to a client.
      </p>
    </CalcCard>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function Calculators() {
  return (
    <section className="space-y-6">
      <SectionTitle sub="Live investor calculators — figures recompute as you type. Yields and appreciation are planning assumptions, not guaranteed returns.">
        Calculators
      </SectionTitle>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RentalYieldCalc />
        <CapitalAppreciationCalc />
        <PaymentPlanCalc />
        <MortgageCalc />
        <ResidencyCalc />
        <CommissionCalc />
      </div>
    </section>
  );
}
