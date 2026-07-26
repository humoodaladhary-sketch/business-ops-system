"use client";

// Live Muscat date/time for the command bar. Renders after mount (no
// hydration mismatch), ticks every 30s without a page refresh, and flags
// when the browser goes offline — the clock is display-only and never the
// authoritative source for server deadlines (those stay UTC server-side).
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

const FMT_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Muscat",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const FMT_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Muscat",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function MuscatClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!now) return null;
  return (
    <span className="hidden items-center gap-2 text-xs tabular-nums text-white/55 sm:inline-flex" aria-live="off">
      {offline && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
          <WifiOff className="h-3 w-3" /> Offline
        </span>
      )}
      <span>{FMT_DATE.format(now)}</span>
      <span className="font-semibold text-white/75">{FMT_TIME.format(now)}</span>
      <span className="text-[10px] uppercase tracking-wide text-white/35">Muscat</span>
    </span>
  );
}
