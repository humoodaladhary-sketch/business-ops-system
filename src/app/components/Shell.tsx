"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, GitBranch, FileSignature, TrendingUp, BarChart3,
  Trophy, UsersRound, Inbox, ShieldCheck, Menu, X, LogOut, Building2, Settings, FileText, Network,
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

export interface ShellUser {
  name: string;
  role: string;
  agentId: string | null;
}

export function Shell({
  links,
  user,
  children,
}: {
  links: { href: string; label: string }[];
  user: ShellUser | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (!user) {
    // Unauthenticated (login) — no chrome.
    return <main className="min-h-screen">{children}</main>;
  }

  const NavList = (
    <nav className="flex flex-col gap-1 px-3">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        const Icon = ICONS[l.href] ?? LayoutDashboard;
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
              active ? "bg-gold/15 text-gold" : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-hairline bg-ink-900/95 backdrop-blur transition-transform md:static md:z-auto md:translate-x-0 print:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-5 py-4">
          <Image src="/alwalaa-mark.png" alt="Alwalaa" width={40} height={34} priority className="h-8 w-auto" />
          <span className="leading-tight">
            <span className="block font-heading text-base tracking-wide text-white">ALWALAA</span>
            <span className="block text-[9px] uppercase tracking-[0.25em] text-gold/80">Operating System</span>
          </span>
          <button className="ml-auto text-white/50 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">{NavList}</div>

        <div className="border-t border-hairline p-3">
          <div className="px-2 pb-2">
            <div className="truncate text-sm text-white/80">{user.name}</div>
            <div className="text-[10px] uppercase tracking-wide text-gold/70">
              {user.role === "ADMIN" ? "Super Admin" : "Advisor"}
            </div>
          </div>
          <a
            href="/api/auth/signout"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-gold"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </a>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3 md:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-white/70">
            <Menu className="h-6 w-6" />
          </button>
          <Image src="/alwalaa-mark.png" alt="Alwalaa" width={36} height={30} className="h-7 w-auto" />
          <span className="font-heading tracking-wide text-white">ALWALAA</span>
        </div>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-7 md:px-8">{children}</main>
        <footer className="px-5 pb-8 pt-2 text-xs text-white/25 md:px-8 print:hidden">
          Alwalaa Real Estate · Muscat, Oman — Alwalaa OS
        </footer>
      </div>
    </div>
  );
}
