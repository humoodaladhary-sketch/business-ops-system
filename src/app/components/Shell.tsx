"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, GitBranch, FileSignature, TrendingUp, BarChart3,
  Trophy, UsersRound, Inbox, ShieldCheck, X, LogOut, Building2, Settings,
  FileText, Network, LayoutGrid, Swords,
} from "lucide-react";
import { cn } from "../lib/cn";
import { ProToggle, WarRoomBadge, useProMode } from "./ProMode";
import { MuscatClock } from "./MuscatClock";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/": LayoutDashboard,
  "/war-room": Swords,
  "/departments": Network,
  "/leads": Users,
  "/pipeline": GitBranch,
  "/deals": FileSignature,
  "/performance": TrendingUp,
  "/analytics": BarChart3,
  "/leaderboard": Trophy,
  "/agents": UsersRound,
  "/portal": Inbox,
  "/inventory": Building2,
  "/reports": FileText,
  "/settings": Settings,
  "/admin/users": ShieldCheck,
};

// Short labels + the four primary destinations for the mobile bottom bar.
const SHORT: Record<string, string> = {
  "/": "Home",
  "/war-room": "Pro Mode",
  "/departments": "Copilots",
  "/leads": "Leads",
  "/inventory": "Inventory",
};
const PRIMARY = ["/", "/departments", "/leads", "/inventory"];

export interface ShellUser {
  name: string;
  role: string;
  agentId: string | null;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "A";

export function Shell({
  links,
  user,
  children,
}: {
  links: { href: string; label: string }[];
  user: ShellUser | null;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { pro } = useProMode();

  if (!user) return <main className="min-h-screen">{children}</main>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const roleLabel = user.role === "ADMIN" ? "CEO · Owner" : "Advisor";
  // In Pro Mode, the first bottom-nav slot becomes Pro Mode itself.
  const primaryHrefs = pro ? ["/war-room", "/departments", "/leads", "/inventory"] : PRIMARY;
  const primaryLinks = primaryHrefs.map((h) => links.find((l) => l.href === h)).filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="min-h-screen md:flex">
      {/* ---------------- Desktop rail (OBB-portal style, Alwalaa palette) ----------------
          A floating cream icon rail: logo mark on top, icon-only nav with hover
          labels, the owner avatar + sign-out pinned at the bottom. */}
      <aside className="sticky top-0 z-40 hidden h-screen shrink-0 py-4 ps-4 md:block print:hidden">
        <div className="flex h-full w-[78px] flex-col items-center rounded-[26px] bg-cream py-4 shadow-2xl">
          <Link href="/" aria-label="Alwalaa OS home" className="grid h-12 w-12 place-items-center rounded-2xl bg-ink">
            <Image src="/alwalaa-mark.png" alt="Alwalaa Real Estate" width={64} height={64} priority className="h-8 w-auto" />
          </Link>
          <nav className="mt-4 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2 py-1" aria-label="Primary">
            {links.map((l) => {
              const active = isActive(l.href);
              const Icon = ICONS[l.href] ?? LayoutDashboard;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch={false}
                  aria-current={active ? "page" : undefined}
                  aria-label={l.label}
                  className={cn(
                    "group relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition",
                    active
                      ? "bg-gold/20 text-gold-deep ring-1 ring-gold/40"
                      : "text-[#15131173] hover:bg-[#1513110d] hover:text-[#151311]",
                  )}
                >
                  <Icon className="h-[19px] w-[19px]" />
                  <span className="pointer-events-none absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {l.label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 flex flex-col items-center gap-1 border-t border-[#15131114] pt-3">
            <span
              title={`${user.name} — ${roleLabel}`}
              className="grid h-10 w-10 place-items-center rounded-full bg-gold/20 text-sm font-semibold text-gold-deep"
            >
              {initials(user.name)}
            </span>
            <a
              href="/api/auth/signout"
              aria-label="Sign out"
              className="group relative grid h-10 w-10 place-items-center rounded-xl text-[#15131159] transition hover:bg-[#1513110d] hover:text-[#151311]"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="pointer-events-none absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                Sign out
              </span>
            </a>
          </div>
        </div>
      </aside>

      {/* ---------------- Content column ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top command bar — logo on mobile, Pro/War-Room switch top-right (all sizes) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline bg-ink-900/90 px-4 py-3 backdrop-blur print:hidden md:px-8">
          <Image src="/alwalaa-logo-white.png" alt="Alwalaa Real Estate" width={80} height={80} priority className="h-8 w-auto md:hidden" />
          <div className="ms-auto flex items-center gap-3">
            <MuscatClock />
            <WarRoomBadge />
            <ProToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 pb-28 md:px-8 md:py-7 md:pb-10">{children}</main>

        <footer className="hidden px-8 pb-8 pt-2 text-xs text-white/25 md:block print:hidden">
          Alwalaa Real Estate · Muscat, Oman — Alwalaa OS
        </footer>
      </div>

      {/* ---------------- Mobile bottom nav ---------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-hairline bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        {primaryLinks.map((l) => {
          const active = isActive(l.href);
          const Icon = ICONS[l.href] ?? LayoutDashboard;
          return (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              className={cn("flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10px]", active ? "text-gold" : "text-white/55")}
            >
              <Icon className="h-5 w-5" />
              {SHORT[l.href] ?? l.label}
              <span className={cn("h-0.5 w-6 rounded-full", active ? "bg-gold" : "bg-transparent")} />
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className={cn("flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10px]", menuOpen ? "text-gold" : "text-white/55")}
        >
          <LayoutGrid className="h-5 w-5" />
          Menu
          <span className="h-0.5 w-6 rounded-full bg-transparent" />
        </button>
      </nav>

      {/* ---------------- Mobile menu sheet ---------------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur md:hidden">
          <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
            <Image src="/alwalaa-logo-white.png" alt="Alwalaa Real Estate" width={80} height={80} className="h-8 w-auto" />
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="ml-auto text-white/60 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/15 font-semibold text-gold">
              {initials(user.name)}
            </span>
            <div>
              <div className="text-white">{user.name}</div>
              <div className="text-[11px] uppercase tracking-wide text-gold/70">{roleLabel}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 overflow-y-auto px-5 py-4">
            {links.map((l) => {
              const active = isActive(l.href);
              const Icon = ICONS[l.href] ?? LayoutDashboard;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch={false}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border text-center text-xs",
                    active ? "border-gold/40 bg-gold/10 text-gold" : "border-hairline bg-ink-100/50 text-white/75 hover:text-white",
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="px-1 leading-tight">{l.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-auto border-t border-hairline p-5">
            <a
              href="/api/auth/signout"
              className="flex items-center justify-center gap-2 rounded-xl border border-hairline py-3 text-sm text-white/70 hover:text-gold"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </a>
            <p className="mt-3 text-center text-[11px] text-white/25">Alwalaa Real Estate — Alwalaa OS</p>
          </div>
        </div>
      )}
    </div>
  );
}
