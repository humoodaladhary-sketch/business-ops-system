"use client";

import { Printer } from "lucide-react";

// Browser print → "Save as PDF" works everywhere, no dependencies. The app
// chrome is hidden in print via the `print:hidden` classes + globals.css.
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold tracking-wide text-ink transition-colors hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden /> Download / Print PDF
    </button>
  );
}
