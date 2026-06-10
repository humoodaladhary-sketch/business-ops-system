"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/cn";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 transition",
              active ? "bg-gold/15 text-gold" : "text-white/60 hover:bg-white/5 hover:text-gold",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
