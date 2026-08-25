// Server-rendered visual sections for the Command Portal: editorial news
// cards, featured-project cards, the sales-funnel strip, the investment
// opportunity card and the collections aging bar. All figures arrive
// pre-computed from live/loaded data — these components only present.
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Building2, Newspaper } from "lucide-react";
import type { FunnelSummary } from "@/domain/crm/funnel";
import { AGING_BUCKET_LABELS, type AgingBucket } from "@/domain/finance/aging";
import { formatOMR } from "../../lib/format";
import { cn } from "../../lib/cn";
import { BrandedArt, type BrandedArtVariant } from "./BrandedArt";

const CARD = "rounded-2xl border border-[#15131114] bg-white/70 shadow-sm";
const MUTED = "text-[#151311a6]";

export interface CardImage {
  url: string;
  alt: string;
  objectPosition: string;
  blurDataUrl?: string | null;
  attribution?: string | null;
  classificationLabel?: string | null;
}

/** Thumbnail block: licensed image when available, branded art otherwise. */
function Thumb({
  image,
  art,
  className,
  sizes,
}: {
  image: CardImage | null;
  art: BrandedArtVariant;
  className?: string;
  sizes: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {image ? (
        <>
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes={sizes}
            loading="lazy"
            placeholder={image.blurDataUrl ? "blur" : "empty"}
            blurDataURL={image.blurDataUrl ?? undefined}
            style={{ objectFit: "cover", objectPosition: image.objectPosition }}
          />
          {image.classificationLabel && (
            <span className="absolute bottom-1 start-1 rounded bg-black/50 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-white/85">
              {image.classificationLabel}
            </span>
          )}
          {image.attribution && (
            <span className="absolute bottom-1 end-1 rounded bg-black/40 px-1 py-0.5 text-[8px] text-white/70">
              {image.attribution}
            </span>
          )}
        </>
      ) : (
        <BrandedArt variant={art} tone="ink" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual news cards
// ---------------------------------------------------------------------------

export interface NewsCardItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  image: CardImage | null;
  relatedLabel: string | null;
}

export function NewsCardsStrip({ items }: { items: NewsCardItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Market news">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((n) => (
          <a
            key={n.link}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(CARD, "group flex gap-3 overflow-hidden p-2.5 transition hover:shadow-md")}
          >
            <Thumb
              image={n.image}
              art="map"
              className="h-[72px] w-[92px] shrink-0 rounded-xl"
              sizes="92px"
            />
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#9C6B3B]">
                <Newspaper className="h-3 w-3" /> {n.relatedLabel ?? "Market news"}
              </div>
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug group-hover:underline">{n.title}</p>
              <p className={cn("mt-1 truncate text-[10px]", MUTED)}>
                {n.source}
                {n.publishedAt ? ` · ${n.publishedAt.slice(0, 10)}` : ""}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Featured project cards
// ---------------------------------------------------------------------------

export interface FeaturedProjectCard {
  name: string;
  developer: string | null;
  categoryLabel: string | null;
  openToAll: boolean;
  availableUnits: number;
  startingPriceOmr: number | null;
  unitTypes: string[];
  image: CardImage | null;
}

export function FeaturedProjectsSection({ projects }: { projects: FeaturedProjectCard[] }) {
  if (projects.length === 0) return null;
  return (
    <section aria-label="Featured projects">
      <h2 className="mb-3 font-heading text-xl">Featured projects · live availability</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {projects.map((p) => (
          <Link
            key={p.name}
            href="/inventory"
            className={cn(CARD, "group overflow-hidden transition hover:shadow-lg")}
          >
            <Thumb
              image={p.image}
              art="grid"
              className="h-32 w-full"
              sizes="(max-width: 640px) 100vw, 300px"
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-heading text-lg leading-tight">{p.name}</p>
                  <p className={cn("mt-0.5 truncate text-[11px]", MUTED)}>{p.developer ?? "—"}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase",
                    p.openToAll ? "bg-[#D7A52C1a] text-[#9C6B3B]" : "bg-[#1513110d] text-[#151311a6]",
                  )}
                >
                  {p.openToAll ? "ITC · all nationalities" : "GCC / Omani"}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className={cn("text-[10px] uppercase tracking-wide", MUTED)}>Available</p>
                  <p className="font-heading text-xl tabular-nums">{p.availableUnits}</p>
                </div>
                <div className="text-end">
                  <p className={cn("text-[10px] uppercase tracking-wide", MUTED)}>From</p>
                  <p className="font-heading text-xl tabular-nums">
                    {p.startingPriceOmr != null ? formatOMR(p.startingPriceOmr, true) : "—"}
                  </p>
                </div>
              </div>
              {p.unitTypes.length > 0 && (
                <p className={cn("mt-2 truncate text-[10px]", MUTED)}>{p.unitTypes.join(" · ")}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sales-funnel strip
// ---------------------------------------------------------------------------

export function FunnelStrip({ funnel }: { funnel: FunnelSummary }) {
  const max = funnel.steps[0]?.count ?? 0;
  if (max === 0) return null;
  return (
    <section aria-label="Sales funnel" className={cn(CARD, "p-5")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl">Sales funnel</h2>
        <span className={cn("text-[11px]", MUTED)}>{funnel.totalOpen} open leads</span>
      </div>
      <div className="mt-4 grid grid-cols-5 items-end gap-2">
        {funnel.steps.map((s) => (
          <div key={s.key} className="text-center">
            <div
              className="mx-auto flex w-full max-w-[76px] items-end justify-center rounded-t-lg bg-gradient-to-t from-[#D7A52C] to-[#e6c36b]"
              style={{ height: `${Math.max(8, Math.round((s.count / max) * 72))}px` }}
            >
              <span className="pb-1 text-xs font-bold text-[#151311]">{s.count}</span>
            </div>
            <p className="mt-1.5 text-[10px] font-medium leading-tight">{s.label}</p>
            <p className={cn("text-[9px] tabular-nums", MUTED)}>
              {s.conversionPct != null ? `${s.conversionPct}%` : " "}
            </p>
          </div>
        ))}
      </div>
      {funnel.bottleneckKey && (
        <p className={cn("mt-2 text-[11px]", MUTED)}>
          Bottleneck:{" "}
          <span className="font-semibold text-[#9C6B3B]">
            {funnel.steps.find((s) => s.key === funnel.bottleneckKey)?.label}
          </span>{" "}
          — the largest drop between stages right now.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Investment opportunity card
// ---------------------------------------------------------------------------

export interface OpportunityCardData {
  reference: string;
  project: string;
  developer: string;
  unitType: string;
  areaSqm: number;
  priceOmr: number;
  pricePerSqmOmr: number;
  openToAll: boolean;
  image: CardImage | null;
}

export function OpportunityCard({ unit }: { unit: OpportunityCardData }) {
  return (
    <section aria-label="Investment opportunity" className={cn(CARD, "group overflow-hidden")}>
      <div className="relative">
        <Thumb image={unit.image} art="chart" className="h-32 w-full" sizes="(max-width: 640px) 100vw, 340px" />
        <span className="absolute start-3 top-3 rounded-full bg-[#D7A52C] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-[#151311]">
          Investment pick
        </span>
      </div>
      <div className="p-4">
        <p className="font-heading text-lg leading-tight">
          {unit.reference} · {unit.project}
        </p>
        <p className={cn("mt-0.5 text-[11px]", MUTED)}>
          {unit.unitType || "Unit"} · {unit.developer || "—"} ·{" "}
          {unit.openToAll ? "ITC — all nationalities" : "GCC/Omani only"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className={cn("text-[9px] uppercase tracking-wide", MUTED)}>Price</p>
            <p className="font-heading text-base tabular-nums">{formatOMR(unit.priceOmr, true)}</p>
          </div>
          <div>
            <p className={cn("text-[9px] uppercase tracking-wide", MUTED)}>Area</p>
            <p className="font-heading text-base tabular-nums">{unit.areaSqm} m²</p>
          </div>
          <div>
            <p className={cn("text-[9px] uppercase tracking-wide", MUTED)}>OMR / m²</p>
            <p className="font-heading text-base tabular-nums">{Math.round(unit.pricePerSqmOmr)}</p>
          </div>
        </div>
        <p className={cn("mt-2 text-[10px]", MUTED)}>
          Best price per m² in live ITC availability — verified inventory facts only. Yields and returns are
          computed in the analyzer, never assumed here.
        </p>
        <Link
          href="/war-room"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#151311] px-4 py-2 text-xs font-semibold text-white transition group-hover:bg-[#2A2313]"
        >
          <Building2 className="h-3.5 w-3.5" /> Analyze investment <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Collections aging bar
// ---------------------------------------------------------------------------

const AGING_COLORS: Record<string, string> = {
  current: "#D7A52C66",
  due_soon: "#D7A52C",
  overdue_1_30: "#f59e0b",
  overdue_31_60: "#ef4444",
  overdue_61_plus: "#991b1b",
  due_date_unverified: "#a8a29e",
};

export function AgingBar({
  buckets,
}: {
  buckets: Record<AgingBucket, { count: number; amountOmr: number }>;
}) {
  const entries = (Object.entries(buckets) as [AgingBucket, { count: number; amountOmr: number }][]).filter(
    ([, v]) => v.amountOmr > 0,
  );
  const total = entries.reduce((s, [, v]) => s + v.amountOmr, 0);
  if (total <= 0) return null;
  return (
    <div className="mt-3">
      <div
        role="img"
        aria-label={`Aging distribution: ${entries
          .map(([b, v]) => `${AGING_BUCKET_LABELS[b]} ${formatOMR(v.amountOmr, true)}`)
          .join(", ")}`}
        className="flex h-2.5 w-full overflow-hidden rounded-full"
      >
        {entries.map(([bucket, v]) => (
          <div
            key={bucket}
            style={{
              width: `${Math.max(2, (v.amountOmr / total) * 100)}%`,
              background: AGING_COLORS[bucket] ?? "#a8a29e",
            }}
            title={`${AGING_BUCKET_LABELS[bucket]}: ${formatOMR(v.amountOmr, true)}`}
          />
        ))}
      </div>
    </div>
  );
}
