"use client";

// Portal hero carousel — the OBB-portal-style rotating highlight card, built
// from LIVE figures passed in by the server (never fabricated content).
// Auto-advances unless the user prefers reduced motion or is hovering.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "../lib/cn";

export interface HeroSlide {
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  tone: "gold" | "ink" | "bronze" | "risk";
}

const TONE_BG: Record<HeroSlide["tone"], string> = {
  gold: "from-[#2A2313] via-[#151311] to-[#0F0D0B]",
  ink: "from-[#1D1A16] via-[#151311] to-[#0F0D0B]",
  bronze: "from-[#2B1F12] via-[#191410] to-[#0F0D0B]",
  risk: "from-[#2A1210] via-[#171110] to-[#0F0D0B]",
};

export function PortalHero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const hover = useRef(false);

  useEffect(() => {
    if (slides.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!hover.current) setIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[Math.min(index, slides.length - 1)];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Business highlights"
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-xl sm:p-10",
        TONE_BG[slide.tone],
      )}
    >
      {/* soft gold glow, echoes the brand without imagery */}
      <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -start-16 h-64 w-64 rounded-full bg-gold/5 blur-3xl" />

      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold/80">{slide.kicker}</p>
      <h2 className="mt-3 max-w-2xl font-heading text-3xl leading-tight sm:text-[40px]">{slide.title}</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">{slide.body}</p>

      <div className="mt-6 flex items-center justify-between gap-4">
        <Link
          href={slide.href}
          className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          {slide.cta} <ArrowUpRight className="h-4 w-4" />
        </Link>
        {slides.length > 1 && (
          <div className="flex items-center gap-2" role="tablist" aria-label="Highlight slides">
            {slides.map((s, i) => (
              <button
                key={s.title}
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1}: ${s.kicker}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-8 bg-gold" : "w-2 bg-white/25 hover:bg-white/40",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
