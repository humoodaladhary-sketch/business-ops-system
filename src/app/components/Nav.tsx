import Link from "next/link";
import Image from "next/image";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/deals", label: "Deals" },
  { href: "/performance", label: "Performance" },
  { href: "/analytics", label: "Analytics" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/agents", label: "Agents" },
  { href: "/portal", label: "Agent Portal" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-y-2 px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/alwalaa-mark.png"
            alt="Alwalaa Real Estate"
            width={44}
            height={38}
            priority
            className="h-9 w-auto"
          />
          <span className="leading-tight">
            <span className="block font-heading text-lg tracking-wide text-white">ALWALAA</span>
            <span className="block text-[10px] uppercase tracking-[0.25em] text-gold/80">Real Estate</span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-white/60 transition hover:bg-white/5 hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
