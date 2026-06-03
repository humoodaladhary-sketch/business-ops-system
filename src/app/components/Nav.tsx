import Link from "next/link";

const LINKS = [
  { href: "/", label: "Thursday View" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/performance", label: "Performance" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/commissions", label: "Commissions" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          {/* Logo placeholder — swap for the supplied mark. */}
          <span className="grid h-9 w-9 place-items-center rounded-md border border-gold/40 bg-gold/10 font-heading text-lg text-gold">
            A
          </span>
          <span className="leading-tight">
            <span className="block font-heading text-lg text-white">Alwalaa</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gold/70">
              Real Estate · Advisory
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
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
