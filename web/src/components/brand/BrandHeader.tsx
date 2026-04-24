import Link from "next/link";

export function BrandHeader() {
  return (
    <header className="border-b border-[var(--color-brand-gray-200)] bg-[var(--color-brand-white)]">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {/* Logomark placeholder — drop alwalaa-logo.png into public/brand/ */}
          <div
            aria-hidden
            className="w-10 h-10 bg-[var(--color-brand-black)] text-[var(--color-brand-white)]
                       flex items-center justify-center font-display text-lg"
          >
            W<span className="text-[var(--color-brand-gold)]">و</span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg tracking-wide uppercase text-[var(--color-brand-black)]">
              Alwalaa
            </div>
            <div className="text-xs tracking-[0.2em] uppercase text-[var(--color-brand-gold)]">
              Real Estate
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/" className="btn-ghost">Dashboard</Link>
          <Link href="/upload" className="btn-ghost">Upload</Link>
          <Link href="/inventory" className="btn-ghost">Inventory</Link>
          <Link href="/reports" className="btn-ghost">Reports</Link>
        </nav>
      </div>
    </header>
  );
}

export function BrandFooter() {
  return (
    <footer className="border-t border-[var(--color-brand-gray-200)] mt-16 py-6 text-center text-xs text-[var(--color-brand-gray-500)]">
      Alwalaa Real Estate · Prepared for: Humood Aladhari · v1.0
    </footer>
  );
}
