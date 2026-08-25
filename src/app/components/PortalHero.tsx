"use client";

// Portal hero carousel v2 — the Command Portal's editorial banner. Slides can
// carry real, licensed photography (signed URLs from the private bucket) with
// a cinematic gradient for text readability; slides without a legitimate
// image render branded fallback artwork instead — never a random photo.
//
// Accessibility & motion: keyboard arrows, swipe, pause/play control, hover
// pause, dot navigation, timed progress (hidden under reduced motion),
// sr-only slide announcements, and a gentle crossfade + zoom that fully
// respects prefers-reduced-motion. Only the active and adjacent slides mount
// their images (first one preloaded, the rest lazy) so the portal stays fast.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "../lib/cn";
import { BrandedArt, type BrandedArtTone, type BrandedArtVariant } from "./portal/BrandedArt";

export interface HeroImage {
  url: string;
  alt: string;
  /** CSS object-position from the stored focal point, e.g. "68% 44%". */
  objectPosition: string;
  objectPositionMobile?: string;
  blurDataUrl?: string | null;
  dominantColor?: string | null;
  /** Required credit line (license), rendered small over the image. */
  attribution?: string | null;
  /** Set for renders/visualizations — shown so they are never taken as real. */
  classificationLabel?: string | null;
}

export interface VisualHeroSlide {
  id: string;
  /** Content-type badge, e.g. "Market update", "Featured project". */
  badge: string;
  /** Small over-title: source label, project, or department. */
  kicker?: string;
  title: string;
  body?: string;
  /** Date or freshness chip. */
  meta?: string;
  primary?: { label: string; href: string; external?: boolean };
  secondary?: { label: string; href: string; external?: boolean };
  tone: BrandedArtTone;
  image?: HeroImage | null;
  /** Fallback art variant when there is no image. */
  art?: BrandedArtVariant;
}

const INTERVAL_MS = 7000;

function ActionLink({
  action,
  variant,
}: {
  action: { label: string; href: string; external?: boolean };
  variant: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50"
      : "inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 backdrop-blur-sm transition hover:border-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
  return action.external ? (
    <a href={action.href} target="_blank" rel="noopener noreferrer" className={cls}>
      {action.label} <ArrowUpRight className="h-4 w-4" />
    </a>
  ) : (
    <Link href={action.href} className={cls}>
      {action.label} <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

export function PortalHero({ slides }: { slides: VisualHeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const hover = useRef(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const goTo = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;
    const t = setInterval(() => {
      if (!hover.current) setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [count, paused, reducedMotion]);

  if (count === 0) return null;
  const slide = slides[Math.min(index, count - 1)];

  // Only the active slide and its neighbours mount images; the very first
  // slide's image is the LCP candidate and gets priority.
  const mounts = new Set([index, (index + 1) % count, (index - 1 + count) % count]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Business highlights"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      }}
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 44) (dx < 0 ? next : prev)();
      }}
      className="group relative min-h-[300px] overflow-hidden rounded-3xl bg-ink text-white shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 sm:min-h-[340px]"
    >
      {/* ---- Background layers (image or branded art), crossfaded ---- */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {s.image && mounts.has(i) ? (
            <>
              <Image
                src={s.image.url}
                alt={i === index ? s.image.alt : ""}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1400px) 75vw, 1100px"
                priority={i === 0}
                placeholder={s.image.blurDataUrl ? "blur" : "empty"}
                blurDataURL={s.image.blurDataUrl ?? undefined}
                style={{
                  objectFit: "cover",
                  // Dedicated mobile crop: the mobile focal point applies below
                  // sm, the desktop one above (CSS vars + responsive classes).
                  ["--hero-fp" as never]: s.image.objectPosition,
                  ["--hero-fp-m" as never]: s.image.objectPositionMobile ?? s.image.objectPosition,
                  backgroundColor: s.image.dominantColor ?? "#151311",
                }}
                className={cn(
                  "[object-position:var(--hero-fp-m)] sm:[object-position:var(--hero-fp)]",
                  "motion-safe:transition-transform motion-safe:duration-[7000ms] motion-safe:ease-linear",
                  i === index && !reducedMotion ? "motion-safe:scale-105" : "scale-100",
                )}
              />
              {/* Cinematic readability: left-to-right + bottom gradients */}
              <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#0F0D0B]/92 via-[#151311]/70 to-[#15131126]" />
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0F0D0B]/85 to-transparent" />
              <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
            </>
          ) : (
            <BrandedArt variant={s.art ?? "monogram"} tone={s.tone} />
          )}
        </div>
      ))}

      {/* ---- Foreground content ---- */}
      <div className="relative flex min-h-[300px] flex-col justify-between p-6 sm:min-h-[340px] sm:p-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink">
              {slide.badge}
            </span>
            {slide.meta && (
              <span className="inline-flex items-center rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/70 backdrop-blur-sm">
                {slide.meta}
              </span>
            )}
            {slide.image?.classificationLabel && (
              <span className="inline-flex items-center rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/75 backdrop-blur-sm">
                {slide.image.classificationLabel}
              </span>
            )}
          </div>
          {slide.kicker && (
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold/90">{slide.kicker}</p>
          )}
          <h2 className="mt-2 max-w-2xl font-heading text-3xl leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:text-[40px]">
            {slide.title}
          </h2>
          {slide.body && (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
              {slide.body}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {slide.primary && <ActionLink action={slide.primary} variant="primary" />}
            {slide.secondary && <ActionLink action={slide.secondary} variant="secondary" />}
          </div>

          {count > 1 && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="Previous slide"
                onClick={prev}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/25 text-white/70 backdrop-blur-sm transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2" role="tablist" aria-label="Highlight slides">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Slide ${i + 1} of ${count}: ${s.badge}`}
                    onClick={() => goTo(i)}
                    className={cn(
                      "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70",
                      i === index ? "w-8 bg-gold" : "w-2 bg-white/30 hover:bg-white/50",
                    )}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next slide"
                onClick={next}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/25 text-white/70 backdrop-blur-sm transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
                aria-pressed={paused}
                onClick={() => setPaused((p) => !p)}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/25 text-white/70 backdrop-blur-sm transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Attribution (license requirement) — small, over the image edge */}
      {slide.image?.attribution && (
        <span className="absolute bottom-2 end-3 rounded bg-black/40 px-1.5 py-0.5 text-[9px] text-white/60 backdrop-blur-sm">
          {slide.image.attribution}
        </span>
      )}

      {/* Timed progress for the active slide (hidden when motion is reduced) */}
      {count > 1 && !paused && !reducedMotion && (
        <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-white/10">
          <div
            key={slide.id}
            className="h-full bg-gold/80 motion-safe:animate-[heroProgress_7s_linear_forwards]"
          />
        </div>
      )}

      {/* Screen-reader slide announcement */}
      <p aria-live="polite" className="sr-only">
        Slide {index + 1} of {count}: {slide.badge} — {slide.title}
      </p>
    </section>
  );
}
