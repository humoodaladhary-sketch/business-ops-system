"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, GitBranch, FileSignature, TrendingUp, BarChart3,
  Trophy, UsersRound, Inbox, ShieldCheck, X, LogOut, Building2, Settings,
  FileText, Network, LayoutGrid,
} from "lucide-react";
import { cn } from "../lib/cn";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/": LayoutDashboard,
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

  if (!user) return <main className="min-h-screen">{children}</main>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const roleLabel = user.role === "ADMIN" ? "CEO · Owner" : "Advisor";
  const primaryLinks = PRIMARY.map((h) => links.find((l) => l.href === h)).filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="min-h-screen md:flex">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="sticky top-0 z-40 hidden h-screen w-64 shrink-0 flex-col border-r border-hairline bg-ink-900/95 backdrop-blur md:flex print:hidden">
        <div className="flex items-center justify-center border-b border-hairline px-5 py-5">
          <Image src="/alwalaa-logo-white.png" alt="Alwalaa Real Estate" width={120} height={120} priority className="h-12 w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {links.map((l) => {
            const active = isActive(l.href);
            const Icon = ICONS[l.href] ?? LayoutDashboard;
            return (
              <Link
                key={l.href}
                href={l.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active ? "bg-gold/15 text-gold ring-1 ring-gold/20" : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-hairline p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-ink-100/60 px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/15 text-sm font-semibold text-gold">
              {initials(user.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-white/85">{user.name}</span>
              <span className="block text-[10px] uppercase tracking-wide text-gold/70">{roleLabel}</span>
            </span>
          </div>
          <a
            href="/api/auth/signout"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-gold"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </a>
        </div>
      </aside>

      {/* ---------------- Content column ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline bg-ink-900/90 px-4 py-3 backdrop-blur md:hidden print:hidden">
          <Image src="/alwalaa-logo-white.png" alt="Alwalaa Real Estate" width={80} height={80} priority className="h-8 w-auto" />
          <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-gold/70">{roleLabel}</span>
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
