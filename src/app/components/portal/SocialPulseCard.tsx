// Social pulse — the connected platforms' direct numbers on the Command
// Portal. Every figure states its source (API vs manual) and freshness;
// disconnected platforms show as exactly that, never as zeros.
import Link from "next/link";
import { ArrowUpRight, Share2 } from "lucide-react";
import type { SocialPulse } from "../../_data/socialPulse";
import { cn } from "../../lib/cn";

const MUTED = "text-[#151311a6]";

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
  threads: "Threads",
  whatsapp: "WhatsApp",
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function SocialPulseCard({ pulse }: { pulse: SocialPulse }) {
  if (pulse.rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[#15131114] bg-white/70 p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-xl">
          <Share2 className="h-4 w-4 text-[#9C6B3B]" /> Social pulse
        </h2>
        <span className={cn("text-[11px]", MUTED)}>{pulse.postedLast30} posts via OS · 30d</span>
      </div>
      <ul className="mt-3 space-y-2">
        {pulse.rows.map((r) => (
          <li key={r.accountId} className="flex items-center justify-between gap-2 rounded-xl border border-[#15131114] bg-white/80 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {PLATFORM_LABEL[r.platform] ?? r.platform}
                <span className={cn("ms-1.5 text-[11px] font-normal", MUTED)}>{r.handle}</span>
              </p>
              <p className={cn("text-[10px]", MUTED)}>
                {r.capturedAt
                  ? `${r.source === "manual" ? "manual entry" : "live API"} · ${r.capturedAt.slice(0, 10)}`
                  : r.status === "connected"
                    ? "connected — no snapshot yet"
                    : "Not connected"}
              </p>
            </div>
            <div className="shrink-0 text-end">
              {r.followers != null ? (
                <>
                  <p className="font-heading text-lg tabular-nums">{fmt(r.followers)}</p>
                  <p className={cn("text-[10px] tabular-nums", (r.followersDelta ?? 0) >= 0 ? "text-emerald-700" : "text-red-700")}>
                    {r.followersDelta != null
                      ? `${r.followersDelta >= 0 ? "▲" : "▼"} ${fmt(Math.abs(r.followersDelta))}`
                      : "followers"}
                  </p>
                </>
              ) : (
                <p className={cn("text-xs", MUTED)}>—</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Link href="/settings/social" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#9C6B3B] hover:underline">
        Manage connections & refresh numbers <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
