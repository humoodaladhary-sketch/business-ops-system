"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { cn } from "../lib/cn";

interface ProModeCtx {
  pro: boolean;
  toggle: () => void;
  setPro: (v: boolean) => void;
}

const Ctx = createContext<ProModeCtx | null>(null);

/**
 * Global Pro / War-Room mode. Flipping it stamps `data-pro="on"` on <html>,
 * which recolours the whole app (gold -> crimson) via the CSS var in globals.css,
 * and persists across reloads. The pre-hydration script in layout.tsx sets the
 * attribute before paint so there's no flash.
 */
export function ProModeProvider({ children }: { children: React.ReactNode }) {
  const [pro, setProState] = useState(false);

  // Hydrate from what the pre-paint script already decided.
  useEffect(() => {
    setProState(document.documentElement.dataset.pro === "on");
  }, []);

  // Reflect + persist.
  useEffect(() => {
    document.documentElement.dataset.pro = pro ? "on" : "off";
    try {
      localStorage.setItem("alwalaa-pro", pro ? "1" : "0");
    } catch {
      /* ignore private-mode storage errors */
    }
  }, [pro]);

  const setPro = useCallback((v: boolean) => setProState(v), []);
  const toggle = useCallback(() => setProState((p) => !p), []);

  return <Ctx.Provider value={{ pro, toggle, setPro }}>{children}</Ctx.Provider>;
}

export function useProMode(): ProModeCtx {
  return useContext(Ctx) ?? { pro: false, toggle: () => {}, setPro: () => {} };
}

/** The top-right switch. Turning it ON drops the owner into the War Room. */
export function ProToggle({ className }: { className?: string }) {
  const { pro, setPro } = useProMode();
  const router = useRouter();

  const onClick = () => {
    const next = !pro;
    setPro(next);
    if (next) router.push("/war-room");
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pro}
      title={pro ? "Exit War Room mode" : "Enter War Room mode"}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition",
        pro ? "border-gold/50 bg-gold/15 text-gold shadow-[0_0_0_1px_rgb(var(--gold)/0.15)]" : "border-hairline text-white/60 hover:text-white",
        className,
      )}
    >
      <Swords className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{pro ? "War Room" : "Pro Mode"}</span>
      <span className={cn("relative h-4 w-7 shrink-0 rounded-full transition", pro ? "bg-gold" : "bg-white/15")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-all", pro ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  );
}

/** Small pulsing indicator shown in the shell header while War Room is active. */
export function WarRoomBadge() {
  const { pro } = useProMode();
  if (!pro) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
      War Room
    </span>
  );
}
