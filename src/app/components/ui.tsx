import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-ink-100/60 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-2xl text-gold">{children}</h2>
      {sub ? <p className="mt-1 text-sm text-white/50">{sub}</p> : null}
    </div>
  );
}

export function StatTile({
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
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-white/45">{label}</span>
      <span className={cn("text-2xl font-semibold tabular-nums", accent ? "text-gold" : "text-white")}>
        {value}
      </span>
      {hint ? <span className="text-xs text-white/40">{hint}</span> : null}
    </Card>
  );
}

const BADGE_VARIANTS: Record<string, string> = {
  default: "bg-white/10 text-white/80",
  gold: "bg-gold/15 text-gold border border-gold/30",
  risk: "bg-risk/15 text-risk border border-risk/30",
  watch: "bg-amber-500/15 text-amber-300 border border-amber-400/30",
  good: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30",
  muted: "bg-white/5 text-white/50",
};

export function Badge({ children, variant = "default" }: { children: ReactNode; variant?: keyof typeof BADGE_VARIANTS }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", BADGE_VARIANTS[variant])}>
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  markers,
  className,
}: {
  value: number; // 0..1 (clamped)
  markers?: number[]; // positions 0..1
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-white/8", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft transition-all"
        style={{ width: `${pct}%` }}
      />
      {markers?.map((m) => (
        <div
          key={m}
          className="absolute top-0 h-full w-px bg-white/30"
          style={{ left: `${m * 100}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
}
