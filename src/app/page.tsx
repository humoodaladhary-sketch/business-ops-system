import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowDownRight, ArrowUpRight, ArrowRight, AlertTriangle, Eye, Coins, Wallet, Landmark, Target,
} from "lucide-react";
import { computePace } from "@/domain";
import { getDemoAgents, dashboardPeriod } from "./_data/demo";
import { teamTotals, bucketize, dealsFor } from "./_data/analytics";
import { loadData } from "./_data/source";
import { loadFinanceSummary } from "./_data/live";
import { Card, SectionTitle, Badge, ProgressBar } from "./components/ui";
import { TierProgress } from "./components/TierProgress";
import { formatOMR, formatPct } from "./lib/format";
import { cn } from "./lib/cn";

// Business data must be read at request time, never frozen into the build.
export const dynamic = "force-dynamic";

// Demo snapshot is taken ~3/4 through the month for a meaningful pace read.
const SNAPSHOT_DAY_OF_MONTH = 20;
const SNAPSHOT_DAYS_IN_MONTH = 28;

// Where "today" sits inside the scored period: live current month uses the
// real clock, a completed live month reads as fully elapsed, and the baked
// snapshot keeps its curated mid-month pace read.
function paceClock(live: boolean, period: string, now = new Date()): { day: number; days: number } {
  if (!live) return { day: SNAPSHOT_DAY_OF_MONTH, days: SNAPSHOT_DAYS_IN_MONTH };
  const [y, m] = period.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const current = now.toISOString().slice(0, 7) === period;
  return { day: current ? now.getUTCDate() : days, days };
}

export default async function ExecutiveCockpit() {
  const [data, finance] = await Promise.all([loadData(), loadFinanceSummary()]);
  const period = dashboardPeriod(data);
  const { day: dayOfMonth, days: daysInMonth } = paceClock(data.live, period);
  const agents = getDemoAgents(data, period);
  const scoring = agents.filter((a) => a.result.targetAmount > 0);

  // Month view (period-scoped) — same computations the dashboard already trusted.
  const teamVolume = scoring.reduce((s, a) => s + a.result.volumeClosed, 0);
  const teamTarget = scoring.reduce((s, a) => s + a.result.targetAmount, 0);
  const teamGross = agents.reduce((s, a) => s + a.result.alwalaaGrossMonth, 0);
  const teamPayout = agents.reduce((s, a) => s + a.result.projectedPayout, 0);
  const netCommission = teamGross - teamPayout; // company's take, after agent splits
  const closings = agents.reduce((s, a) => s + a.result.dealCount, 0);
  const attainment = teamTarget ? teamVolume / teamTarget : 0;

  // Running balances (all-time) from the analytics layer.
  const totals = teamTotals(data); // { deals, volume, earned, pendingAgent, alwalaaReceivable }

  const atRisk = agents.filter((a) => a.atRisk.atRisk);
  const watch = agents.filter((a) => a.atRisk.watch && !a.atRisk.atRisk);
  const flagged = agents.filter((a) => a.atRisk.atRisk || a.atRisk.watch);

  // Momentum: this month vs last, from the existing monthly aggregation.
  const monthly = bucketize(dealsFor(data, "ALL"), "month");
  const curIdx = monthly.findIndex((b) => b.key === period);
  const cur = curIdx >= 0 ? monthly[curIdx] : monthly[monthly.length - 1];
  const prev = cur ? monthly[monthly.indexOf(cur) - 1] : undefined;

  const kpis = [
    { icon: Coins, label: "Sales volume", value: formatOMR(teamVolume, true), hint: `${closings} closings this month`, href: "/performance", accent: true },
    { icon: Wallet, label: "Net commission", value: formatOMR(netCommission, true), hint: "company, after agent splits", href: "/commissions" },
    { icon: Landmark, label: "Cash to collect", value: formatOMR(totals.alwalaaReceivable, true), hint: "developer commission receivable", href: "/commissions" },
    { icon: Target, label: "Attainment", value: formatPct(attainment), hint: `of ${formatOMR(teamTarget, true)} target`, href: "/leaderboard" },
  ];

  const momentum = cur
    ? [
        { label: "Closed volume", cur: cur.volume, prev: prev?.volume, money: true },
        { label: "Deals closed", cur: cur.deals, prev: prev?.deals, money: false },
        { label: "Commission booked", cur: cur.commission, prev: prev?.commission, money: true },
      ]
    : [];

  const attention: AttentionProps[] = [];
  if (atRisk.length)
    attention.push({ tone: "risk", icon: AlertTriangle, title: `${atRisk.length} At Risk`, detail: atRisk.map((a) => a.name).join(", "), href: "/performance" });
  if (watch.length)
    attention.push({ tone: "watch", icon: Eye, title: `${watch.length} on Watch`, detail: `${watch.map((a) => a.name).join(", ")} — no closings this month`, href: "/performance" });
  if (totals.alwalaaReceivable > 0)
    attention.push({ tone: "gold", icon: Landmark, title: `${formatOMR(totals.alwalaaReceivable, true)} to collect`, detail: "Developer commission not yet received", href: "/commissions" });
  if (totals.pendingAgent > 0)
    attention.push({ tone: "gold", icon: Wallet, title: `${formatOMR(totals.pendingAgent, true)} owed to agents`, detail: "Payouts pending release", href: "/commissions" });
  if (finance && finance.overdueCount > 0)
    attention.push({ tone: "risk", icon: AlertTriangle, title: `${finance.overdueCount} overdue invoice${finance.overdueCount === 1 ? "" : "s"}`, detail: `${formatOMR(finance.overdueOMR, true)} past due — chase collections`, href: "/departments/finance" });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold/70">Executive cockpit</p>
          <h1 className="mt-1 font-heading text-4xl text-white">Command Center</h1>
          <p className="mt-1 text-white/50">
            Period {period} · team pace, momentum, and what needs your call — recomputed on every close.
          </p>
        </div>
        <Badge variant={data.live ? "gold" : "watch"}>{data.live ? "Live · Supabase" : "Snapshot · not live"}</Badge>
      </div>

      {/* Hero KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      {/* Cash reality — live from the Zoho Books sync */}
      {finance && (
        <div>
          <SectionTitle sub="Live from Zoho Books — the same numbers the Finance copilot quotes.">
            Cash reality
          </SectionTitle>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi icon={Landmark} label="Invoiced (all time)" value={formatOMR(finance.invoicedOMR, true)} hint={`${finance.invoiceCount} commission invoices`} href="/departments/finance" />
            <Kpi icon={Coins} label="Collected" value={formatOMR(finance.collectedOMR, true)} hint="recorded collections" href="/departments/finance" />
            <Kpi icon={Wallet} label="Outstanding" value={formatOMR(finance.outstandingOMR, true)} hint="invoiced, not yet collected" href="/departments/finance" accent />
            <Kpi icon={AlertTriangle} label="Overdue" value={formatOMR(finance.overdueOMR, true)} hint={`${finance.overdueCount} invoices past due`} href="/departments/finance" />
          </div>
        </div>
      )}

      {/* Momentum — this month vs last */}
      {momentum.length > 0 && (
        <div>
          <SectionTitle sub={prev ? `${cur!.label} vs ${prev.label} — closed production, month over month.` : `${cur!.label} — closed production so far.`}>
            Momentum
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            {momentum.map((m) => (
              <MomentumCell key={m.label} {...m} />
            ))}
          </div>
        </div>
      )}

      {/* What needs you — attention strip */}
      <div>
        <SectionTitle sub="Surfaced automatically from live flags and balances — act or delegate.">What needs you</SectionTitle>
        {attention.length === 0 ? (
          <Card>
            <p className="text-sm text-white/50">All clear — no flags or outstanding balances need your attention.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attention.map((a) => (
              <AttentionItem key={a.title} {...a} />
            ))}
          </div>
        )}
      </div>

      {/* Pace + accountability */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle sub="Linear pace through the month — gold bar is actual, marker is where pace expects you.">
            Pace check
          </SectionTitle>
          <Card className="space-y-3">
            {scoring.map((a) => {
              const pace = computePace({
                volumeClosed: a.result.volumeClosed,
                targetAmount: a.result.targetAmount,
                dayOfMonth,
                daysInMonth,
              });
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm text-white/70">{a.name}</span>
                  <ProgressBar value={a.result.pctOfTarget} markers={[pace.expectedPct]} className="flex-1" />
                  <span className="w-12 text-right text-sm tabular-nums text-white/60">
                    {formatPct(a.result.pctOfTarget)}
                  </span>
                  <span className="w-20 text-right">
                    {pace.aheadOfPace ? <Badge variant="good">ahead</Badge> : <Badge variant="watch">behind</Badge>}
                  </span>
                </div>
              );
            })}
          </Card>
        </div>

        <div>
          <SectionTitle sub="Auto-flagged; At Risk opens a CEO review task.">Accountability</SectionTitle>
          <Card className="space-y-3">
            {flagged.length === 0 && <p className="text-sm text-white/50">No flags this period.</p>}
            {flagged.map((a) => (
              <div key={a.id} className="rounded-lg border border-hairline bg-ink-900/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{a.name}</span>
                  {a.atRisk.atRisk ? <Badge variant="risk">At Risk</Badge> : <Badge variant="watch">Watch</Badge>}
                </div>
                <p className="mt-1 text-xs text-white/50">{a.atRisk.reason}</p>
              </div>
            ))}
            {agents
              .filter((a) => a.inRampWindow || a.exempt)
              .map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-hairline bg-ink-900/20 p-3">
                  <span className="text-sm text-white/70">{a.name}</span>
                  <Badge variant="muted">{a.exempt ? "Trainee · exempt" : "Ramp · exempt"}</Badge>
                </div>
              ))}
          </Card>
        </div>
      </div>

      {/* Live tier progress */}
      <div>
        <SectionTitle sub="The live comp plan — each advisor's next-tier nudge.">Live tier progress</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents
            .filter((a) => a.result.targetAmount > 0)
            .map((a) => (
              <TierProgress
                key={a.id}
                name={a.name}
                role={a.role}
                pct={a.result.pctOfTarget}
                tierName={a.result.currentTier}
                splitRate={a.result.currentSplitRate}
                volume={a.result.volumeClosed}
                target={a.result.targetAmount}
                projectedPayout={a.result.projectedPayout}
                nudge={a.nudge}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// ---- Presentation-only helpers (server components) -------------------------

type IconType = ComponentType<{ className?: string }>;

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  href,
  accent,
}: {
  icon: IconType;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-white/45">{label}</span>
        <Icon className={cn("h-4 w-4", accent ? "text-gold" : "text-white/30")} />
      </div>
      <div className={cn("mt-3 text-3xl font-semibold tabular-nums", accent ? "text-gold" : "text-white")}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/40">{hint}</div> : null}
      {href ? (
        <div className="mt-3 flex items-center gap-1 text-[11px] text-white/30 transition group-hover:text-gold">
          Open <ArrowUpRight className="h-3 w-3" />
        </div>
      ) : null}
    </>
  );
  const cls = cn(
    "group rounded-xl border border-hairline p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition",
    accent ? "bg-gradient-to-br from-gold/10 to-ink-100/60" : "bg-ink-100/60",
    href && "hover:border-gold/40",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function MomentumCell({ label, cur, prev, money }: { label: string; cur: number; prev?: number; money?: boolean }) {
  const fmt = (n: number) => (money ? formatOMR(n, true) : String(n));
  const diff = prev == null ? null : cur - prev;
  const pct = prev != null && prev !== 0 ? (cur - prev) / prev : null;
  const up = (diff ?? 0) >= 0;
  return (
    <Card className="flex flex-col gap-2">
      <span className="text-[11px] uppercase tracking-wide text-white/45">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-white">{fmt(cur)}</span>
      {diff == null ? (
        <span className="text-xs text-white/35">no prior month</span>
      ) : (
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", up ? "text-emerald-400" : "text-risk")}>
          {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {up ? "+" : ""}
          {fmt(diff)}
          {pct != null ? <span className="text-white/40">· {up ? "+" : ""}{formatPct(pct)}</span> : null}
        </span>
      )}
    </Card>
  );
}

interface AttentionProps {
  tone: "risk" | "watch" | "gold";
  icon: IconType;
  title: string;
  detail: string;
  href: string;
}

const ATTENTION_TONE: Record<AttentionProps["tone"], string> = {
  risk: "border-risk/30 bg-risk/10 text-risk",
  watch: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  gold: "border-gold/30 bg-gold/10 text-gold",
};

function AttentionItem({ tone, icon: Icon, title, detail, href }: AttentionProps) {
  return (
    <Link
      href={href}
      className={cn("group flex items-start gap-3 rounded-xl border p-4 transition hover:brightness-125", ATTENTION_TONE[tone])}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-white/55">{detail}</span>
      </span>
      <ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}
