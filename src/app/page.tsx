import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowUpRight, AlertTriangle, BarChart3, Building2, CalendarX2, FileText, Map,
  Megaphone, Sparkles, Swords, TrendingUp, Users, Wallet,
} from "lucide-react";
import { computePace } from "@/domain";
import { AGING_BUCKET_LABELS, type AgingBucket } from "@/domain/finance/aging";
import { getDemoAgents, dashboardPeriod } from "./_data/demo";
import { loadData } from "./_data/source";
import { loadFinanceSummary } from "./_data/live";
import { loadInboxTasks, loadUnitCounts } from "./_data/portal";
import { loadNews } from "./_data/news";
import { PortalHero, type HeroSlide } from "./components/PortalHero";
import { formatOMR, formatPct } from "./lib/format";
import { cn } from "./lib/cn";

// Business data must be read at request time, never frozen into the build.
export const dynamic = "force-dynamic";

// Demo snapshot is taken ~3/4 through the month for a meaningful pace read.
const SNAPSHOT_DAY_OF_MONTH = 20;
const SNAPSHOT_DAYS_IN_MONTH = 28;

function paceClock(live: boolean, period: string, now = new Date()): { day: number; days: number } {
  if (!live) return { day: SNAPSHOT_DAY_OF_MONTH, days: SNAPSHOT_DAYS_IN_MONTH };
  const [y, m] = period.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const current = now.toISOString().slice(0, 7) === period;
  return { day: current ? now.getUTCDate() : days, days };
}

// The launcher — six copilots + the system surfaces, OBB-portal style tiles
// re-keyed to the Alwalaa palette (each department keeps its accent hue).
type IconType = ComponentType<{ className?: string }>;
interface Tile { href: string; title: string; sub: string; icon: IconType; grad: string }

const DEPT_TILES: Tile[] = [
  { href: "/departments/sales", title: "Sales", sub: "Pipeline, leads and closings", icon: TrendingUp, grad: "from-emerald-700 to-teal-950" },
  { href: "/departments/marketing", title: "Marketing", sub: "Sources, content and campaigns", icon: Megaphone, grad: "from-fuchsia-700 to-purple-950" },
  { href: "/departments/finance", title: "Finance", sub: "Invoices, collections, payouts", icon: Wallet, grad: "from-[#D7A52C] to-[#7a5326]" },
  { href: "/departments/hr", title: "HR & Admin", sub: "Staff, leave and contracts", icon: Users, grad: "from-sky-700 to-blue-950" },
  { href: "/departments/inventory", title: "Inventory", sub: "Units, availability, stock", icon: Building2, grad: "from-orange-600 to-amber-900" },
  { href: "/departments/expert", title: "Client Advisory", sub: "Match, ROI case, pitch (read-only)", icon: Sparkles, grad: "from-[#3a2f1f] to-[#151311]" },
];

const SYSTEM_TILES: Tile[] = [
  { href: "/war-room", title: "Pro Mode", sub: "Calculators, offers, ITC map", icon: Swords, grad: "from-red-800 to-rose-950" },
  { href: "/war-room", title: "ITC Map", sub: "Zones, eligibility, briefs", icon: Map, grad: "from-teal-700 to-cyan-950" },
  { href: "/reports", title: "Reports", sub: "Presentation-grade monthly", icon: FileText, grad: "from-stone-600 to-stone-900" },
  { href: "/analytics", title: "Analytics", sub: "Agents, rankings, trends", icon: BarChart3, grad: "from-indigo-700 to-slate-950" },
];

export default async function PortalHome() {
  const [data, finance, inbox, unitCounts, news] = await Promise.all([
    loadData(),
    loadFinanceSummary(),
    loadInboxTasks(),
    loadUnitCounts(),
    loadNews(6),
  ]);
  const period = dashboardPeriod(data);
  const { day: dayOfMonth, days: daysInMonth } = paceClock(data.live, period);
  const agents = getDemoAgents(data, period);
  const scoring = agents.filter((a) => a.result.targetAmount > 0);

  const teamVolume = scoring.reduce((s, a) => s + a.result.volumeClosed, 0);
  const teamTarget = scoring.reduce((s, a) => s + a.result.targetAmount, 0);
  const teamGross = agents.reduce((s, a) => s + a.result.alwalaaGrossMonth, 0);
  const teamPayout = agents.reduce((s, a) => s + a.result.projectedPayout, 0);
  const closings = agents.reduce((s, a) => s + a.result.dealCount, 0);
  const attainment = teamTarget ? teamVolume / teamTarget : 0;
  const atRisk = agents.filter((a) => a.atRisk.atRisk);
  const watch = agents.filter((a) => a.atRisk.watch && !a.atRisk.atRisk);

  // Hero slides — live business news first (OBB-portal style), with the cash
  // call-to-action pinned ahead of it whenever collections are overdue. Every
  // figure comes from live/loaded data; missing data means no slide.
  const slides: HeroSlide[] = [];
  const NEWS_TONES: HeroSlide["tone"][] = ["ink", "bronze", "gold"];
  news.slice(0, 4).forEach((n, i) => {
    slides.push({
      meta: n.publishedAt ? n.publishedAt.slice(0, 10) : undefined,
      // Google News is a discovery aggregator, not verification — say so.
      kicker: `Aggregated news · ${n.source}`,
      title: n.title,
      body: "",
      href: n.link,
      cta: "Read more",
      tone: NEWS_TONES[i % NEWS_TONES.length],
      external: true,
    });
  });
  if (finance) {
    // Overdue cash outranks headlines — pin it as the first slide.
    slides[finance.overdueCount > 0 ? "unshift" : "push"]({
      kicker: "Finance · live from Zoho Books",
      title: `${formatOMR(finance.outstandingOMR, true)} outstanding to collect`,
      body: `${formatOMR(finance.invoicedOMR, true)} invoiced across ${finance.invoiceCount} commission invoices · ${formatOMR(finance.collectedOMR, true)} recorded collected · ${finance.overdueCount} overdue worth ${formatOMR(finance.overdueOMR, true)}.`,
      href: "/departments/finance",
      cta: "Chase collections",
      tone: finance.overdueCount > 0 ? "risk" : "gold",
    });
  }
  const lastClose = data.deals
    .filter((d) => d.stage === "CLOSED_WON" && d.closeDate)
    .sort((a, b) => (a.closeDate! < b.closeDate! ? 1 : -1))[0];
  if (lastClose) {
    slides.push({
      kicker: "Latest closing",
      title: `${lastClose.client} — ${formatOMR(lastClose.value, true)}`,
      body: `${lastClose.project} · ${lastClose.developer}${lastClose.unitNumber ? ` · unit ${lastClose.unitNumber}` : ""} · closed ${lastClose.closeDate}.`,
      href: "/deals",
      cta: "All deals",
      tone: "gold",
    });
  }
  const openLeads = data.leads.filter((l) => !["CLOSED_WON", "CLOSED_LOST"].includes(l.stage));
  if (openLeads.length > 0) {
    slides.push({
      kicker: "Pipeline",
      title: `${openLeads.length} investors in play`,
      body: `Period ${period}: ${formatOMR(teamVolume, true)} closed of ${formatOMR(teamTarget, true)} target (${formatPct(attainment)}) · ${closings} closings.`,
      href: "/pipeline",
      cta: "Open pipeline",
      tone: "ink",
    });
  }
  if (unitCounts) {
    const available = unitCounts.available ?? 0;
    const total = Object.values(unitCounts).reduce((s, n) => s + n, 0);
    slides.push({
      kicker: "Inventory · live",
      title: `${available} units available to sell`,
      body: `${total} units tracked · ${unitCounts.reserved ?? 0} reserved · ${unitCounts.sold ?? 0} sold. The single source of truth for what Alwalaa can pitch today.`,
      href: "/inventory",
      cta: "Browse inventory",
      tone: "bronze",
    });
  }

  const kpis = [
    { label: "Sales volume", value: formatOMR(teamVolume, true), hint: `${closings} closings · ${period}` },
    { label: "Net commission", value: formatOMR(teamGross - teamPayout, true), hint: "company, after splits" },
    { label: "Attainment", value: formatPct(attainment), hint: `of ${formatOMR(teamTarget, true)} target` },
    ...(finance
      ? [
          { label: "Collected", value: formatOMR(finance.collectedOMR, true), hint: "recorded collections" },
          { label: "Outstanding", value: formatOMR(finance.outstandingOMR, true), hint: `${finance.overdueCount} overdue`, accent: true },
        ]
      : []),
  ];

  /* Light portal sheet styling (cream #FBF8F1, near-black #151311) */
  const CARD = "rounded-2xl border border-[#15131114] bg-white/70 shadow-sm";
  const MUTED = "text-[#151311a6]";

  return (
    <div className="rounded-3xl bg-cream p-4 text-[#151311] shadow-2xl sm:p-6 lg:p-8">
      {/* Portal header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#9C6B3B]">Alwalaa OS</p>
          <h1 className="mt-1 font-heading text-3xl sm:text-4xl">Command Portal</h1>
        </div>
        {/* Source health — active source, why, and freshness (rendered per request) */}
        <div className="text-end">
          <span
            className={cn(
              "inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
              data.live ? "border-[#D7A52C66] bg-[#D7A52C1a] text-[#9C6B3B]" : "border-amber-500/40 bg-amber-500/10 text-amber-700",
            )}
          >
            {data.live ? "Live · Supabase" : "Snapshot · not live"}
          </span>
          <p className={cn("mt-1 text-[10px]", MUTED)}>
            {data.live
              ? "Reading the system of record"
              : "Supabase unreachable or CRM seed not applied — labeled snapshot shown"}
            {" · as of "}
            {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Muscat", hour: "2-digit", minute: "2-digit" }).format(new Date())}
            {" Muscat"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        {/* ---------------- Main column ---------------- */}
        <div className="min-w-0 space-y-6">
          <div>
            <PortalHero slides={slides} />
            <div className="mt-2 flex items-center justify-between px-1">
              <p className={cn("text-[11px]", MUTED)}>
                {news.length > 0 ? "Live market feed — Oman real estate, MoHUP, Omran & partners · refreshes ~30 min" : "Business highlights"}
              </p>
              <Link href="/news" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9C6B3B] hover:underline">
                All news <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* KPI band */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {kpis.map((k) => (
              <div key={k.label} className={cn(CARD, "p-4")}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#15131180]">{k.label}</div>
                <div className={cn("mt-2 font-heading text-2xl tabular-nums", "accent" in k && k.accent ? "text-[#9C6B3B]" : "")}>
                  {k.value}
                </div>
                <div className={cn("mt-1 text-[11px]", MUTED)}>{k.hint}</div>
              </div>
            ))}
          </div>

          {/* Department launcher */}
          <section>
            <h2 className="mb-3 font-heading text-xl">Departments</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DEPT_TILES.map((t) => (
                <LauncherTile key={t.title} {...t} />
              ))}
            </div>
          </section>

          {/* System launcher */}
          <section>
            <h2 className="mb-3 font-heading text-xl">Workspace</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {SYSTEM_TILES.map((t) => (
                <LauncherTile key={t.title} {...t} compact />
              ))}
            </div>
          </section>
        </div>

        {/* ---------------- Rail ---------------- */}
        <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          {/* Collections queue — cash first, from verified aging */}
          {finance && finance.aging.openCount > 0 && (
            <div className={cn(CARD, "p-5")}>
              <h2 className="font-heading text-xl">Collections queue</h2>
              <p className={cn("mt-0.5 text-[11px]", MUTED)}>
                {finance.aging.openCount} open invoices · {formatOMR(finance.aging.openAmountOmr, true)} to collect
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(Object.entries(finance.aging.buckets) as [AgingBucket, { count: number; amountOmr: number }][])
                  .filter(([, v]) => v.count > 0)
                  .map(([bucket, v]) => (
                    <span
                      key={bucket}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        bucket.startsWith("overdue")
                          ? "border-red-300 bg-red-500/10 text-red-700"
                          : bucket === "due_date_unverified"
                            ? "border-amber-400/50 bg-amber-500/10 text-amber-700"
                            : "border-[#15131121] text-[#151311a6]",
                      )}
                    >
                      {AGING_BUCKET_LABELS[bucket]}: {v.count} · {formatOMR(v.amountOmr, true)}
                    </span>
                  ))}
              </div>
              <ul className="mt-4 space-y-2">
                {finance.aging.queue.slice(0, 3).map((q) => (
                  <li key={`${q.reference}-${q.developer}`} className="rounded-xl border border-[#15131114] bg-white/80 p-3">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{q.reference ?? "(no ref)"}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatOMR(q.amountOmr, true)}</span>
                    </div>
                    <p className={cn("mt-0.5 text-[11px]", MUTED)}>
                      {q.developer ?? "—"} ·{" "}
                      {q.daysOverdue != null ? (
                        <span className="font-semibold text-red-700">{q.daysOverdue} days overdue</span>
                      ) : (
                        AGING_BUCKET_LABELS[q.bucket]
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href="/departments/finance"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#9C6B3B] hover:underline"
              >
                Open Finance copilot to chase <ArrowUpRight className="h-3 w-3" />
              </Link>
              {finance.aging.buckets.due_date_unverified.count > 0 && (
                <p className={cn("mt-2 text-[10px]", MUTED)}>
                  {finance.aging.buckets.due_date_unverified.count} invoices have unverified due dates — set them (with the
                  contractual basis) before treating them as overdue.
                </p>
              )}
            </div>
          )}

          {/* Waiting on you — cross-department handoffs */}
          <div className={cn(CARD, "p-5")}>
            <h2 className="font-heading text-xl">Waiting on you</h2>
            <p className={cn("mt-0.5 text-[11px]", MUTED)}>Open cross-department handoffs</p>
            {!inbox || inbox.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#1513110d]">
                  <CalendarX2 className="h-7 w-7 text-[#15131159]" />
                </span>
                <p className="mt-4 font-heading text-lg">All clear</p>
                <p className={cn("mt-1 text-xs", MUTED)}>
                  {inbox ? "No open handoffs between departments." : "Connects once Supabase is configured."}
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {inbox.map((t) => (
                  <li key={t.id} className="rounded-xl border border-[#15131114] bg-white/80 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{t.title}</span>
                      {t.priority === "high" && (
                        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                          High
                        </span>
                      )}
                    </div>
                    <p className={cn("mt-1 text-[11px]", MUTED)}>
                      {t.from_department} → {t.to_department} · {t.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pace & flags */}
          <div className={cn(CARD, "p-5")}>
            <h2 className="font-heading text-xl">Pace &amp; flags</h2>
            <p className={cn("mt-0.5 text-[11px]", MUTED)}>
              Day {dayOfMonth}/{daysInMonth} of {period}
            </p>
            <div className="mt-4 space-y-3">
              {scoring.map((a) => {
                const pace = computePace({
                  volumeClosed: a.result.volumeClosed,
                  targetAmount: a.result.targetAmount,
                  dayOfMonth,
                  daysInMonth,
                });
                return (
                  <div key={a.id}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium">{a.name}</span>
                      <span className={cn("shrink-0 tabular-nums", pace.aheadOfPace ? "text-emerald-700" : "text-[#9C6B3B]")}>
                        {formatPct(a.result.pctOfTarget)} · {pace.aheadOfPace ? "ahead" : "behind"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#15131114]">
                      <div
                        className="h-full rounded-full bg-[#D7A52C]"
                        style={{ width: `${Math.min(100, Math.round(a.result.pctOfTarget * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {scoring.length === 0 && <p className={cn("text-xs", MUTED)}>No agents with targets this period.</p>}
            </div>
            {(atRisk.length > 0 || watch.length > 0) && (
              <div className="mt-4 space-y-2 border-t border-[#15131114] pt-3">
                {atRisk.map((a) => (
                  <Link key={a.id} href="/performance" className="flex items-center gap-2 text-xs text-red-700 hover:underline">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {a.name} — at risk: {a.atRisk.reason}
                  </Link>
                ))}
                {watch.map((a) => (
                  <Link key={a.id} href="/performance" className="flex items-center gap-2 text-xs text-amber-700 hover:underline">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {a.name} — on watch
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// OBB-style gradient launcher tile: icon chip, title, subtitle, corner action.
function LauncherTile({ href, title, sub, icon: Icon, grad, compact }: Tile & { compact?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-md transition hover:shadow-xl",
        grad,
        compact ? "min-h-[124px]" : "min-h-[150px]",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
        <Icon className="h-5 w-5" />
      </span>
      <div className={cn("font-heading", compact ? "mt-3 text-lg" : "mt-4 text-xl")}>{title}</div>
      <p className="mt-0.5 max-w-[85%] text-xs leading-snug text-white/70">{sub}</p>
      <span className="absolute bottom-4 end-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 transition group-hover:bg-white/30">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
