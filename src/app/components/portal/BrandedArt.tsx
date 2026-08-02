// Branded fallback artwork — the honest alternative to an unlicensed photo.
// Deliberate, premium, and clearly a graphic: gold gradients, the stylized
// Oman silhouette, architectural line patterns, or a quiet chart motif.
// Server-safe (no client hooks). Decorative by design: aria-hidden, with the
// text content carried by the surrounding slide/card.
import { OMAN_PATH, MUSANDAM_PATH, OMAN_VIEWBOX } from "./omanOutline";
import { cn } from "../../lib/cn";

export type BrandedArtVariant = "monogram" | "map" | "grid" | "chart";
export type BrandedArtTone = "gold" | "ink" | "bronze" | "risk";

const TONE_BG: Record<BrandedArtTone, string> = {
  gold: "bg-gradient-to-br from-[#2A2313] via-[#151311] to-[#0F0D0B]",
  ink: "bg-gradient-to-br from-[#1D1A16] via-[#151311] to-[#0F0D0B]",
  bronze: "bg-gradient-to-br from-[#2B1F12] via-[#191410] to-[#0F0D0B]",
  risk: "bg-gradient-to-br from-[#2A1210] via-[#171110] to-[#0F0D0B]",
};

export function BrandedArt({
  variant = "monogram",
  tone = "gold",
  className,
}: {
  variant?: BrandedArtVariant;
  tone?: BrandedArtTone;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden", TONE_BG[tone], className)}>
      {/* soft brand glows */}
      <div className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -start-16 h-64 w-64 rounded-full bg-gold/5 blur-3xl" />

      {variant === "map" && (
        <svg
          viewBox={OMAN_VIEWBOX}
          className="absolute -end-6 top-1/2 h-[130%] -translate-y-1/2 opacity-[0.16]"
          preserveAspectRatio="xMidYMid meet"
        >
          <path d={OMAN_PATH} fill="none" stroke="rgb(var(--gold))" strokeWidth="1.4" />
          <path d={MUSANDAM_PATH} fill="none" stroke="rgb(var(--gold))" strokeWidth="1.4" />
          <path d={OMAN_PATH} fill="rgb(var(--gold))" fillOpacity="0.06" />
        </svg>
      )}

      {variant === "grid" && (
        <svg className="absolute inset-0 h-full w-full opacity-[0.10]" aria-hidden>
          <defs>
            <pattern id="alw-arch" width="56" height="56" patternUnits="userSpaceOnUse">
              <path d="M0 56 L56 0" stroke="rgb(var(--gold))" strokeWidth="0.6" />
              <path d="M28 56 L56 28" stroke="rgb(var(--gold))" strokeWidth="0.4" />
              <circle cx="0" cy="56" r="1" fill="rgb(var(--gold))" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#alw-arch)" />
        </svg>
      )}

      {variant === "chart" && (
        <svg viewBox="0 0 400 160" className="absolute inset-x-0 bottom-0 h-3/5 w-full opacity-[0.14]" preserveAspectRatio="none">
          <path
            d="M0 130 L50 118 L100 122 L150 96 L200 104 L250 74 L300 82 L350 52 L400 40 L400 160 L0 160 Z"
            fill="rgb(var(--gold))"
            fillOpacity="0.25"
          />
          <path
            d="M0 130 L50 118 L100 122 L150 96 L200 104 L250 74 L300 82 L350 52 L400 40"
            fill="none"
            stroke="rgb(var(--gold))"
            strokeWidth="1.5"
          />
        </svg>
      )}

      {variant === "monogram" && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="select-none font-heading text-[11rem] leading-none text-gold/[0.08]">A</span>
        </div>
      )}
    </div>
  );
}
