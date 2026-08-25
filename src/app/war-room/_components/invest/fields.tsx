"use client";

// Shared form primitives for the Invest tab — same visual language as the
// Calculators panel (ink fields, hairline borders, gold focus that recolours
// crimson in Pro Mode).
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../lib/cn";

export const FIELD_CLS =
  "w-full rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white tabular-nums placeholder:text-white/30 focus:border-gold/50 focus:outline-none";

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block", disabled && "opacity-50")}>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          className={FIELD_CLS}
          value={Number.isFinite(value) ? value : ""}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
        {suffix ? <span className="shrink-0 text-sm text-white/40">{suffix}</span> : null}
      </div>
      {hint ? <span className="mt-1 block text-[11px] tabular-nums text-white/35">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">{label}</span>
      <input
        type="text"
        className={FIELD_CLS}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-white/45">{label}</span>
      <select className={FIELD_CLS} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active ? "border-gold/50 bg-gold/15 text-gold" : "border-hairline text-white/55 hover:text-white",
      )}
    >
      {label}
    </button>
  );
}

/** Collapsible workflow section — progressive disclosure for the Invest flow. */
export function StepCard({
  step,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  step: number;
  title: string;
  /** One-line state summary shown when collapsed (live values, not placeholders). */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-ink-100/60">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
          {step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{title}</span>
          {!open && summary ? (
            <span className="block truncate text-xs text-white/45">{summary}</span>
          ) : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/40 transition", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-hairline p-4">{children}</div> : null}
    </section>
  );
}

/** Small dt/dd metric for result grids. */
export function Metric({
  label,
  value,
  hint,
  accent,
  negative,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-white/45">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums sm:text-lg",
          negative ? "text-risk" : accent ? "text-gold" : "text-white",
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-[11px] tabular-nums text-white/40">{hint}</span> : null}
    </div>
  );
}

/** "—" for null metrics: undefined ratios are shown honestly, never as 0. */
export function fmtOrDash(v: number | null | undefined, fmt: (n: number) => string): string {
  return v == null ? "—" : fmt(v);
}
