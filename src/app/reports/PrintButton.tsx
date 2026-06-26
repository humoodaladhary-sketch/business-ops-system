"use client";

import { Printer } from "lucide-react";

// Browser print → "Save as PDF" works everywhere, no dependencies. The app
// chrome is hidden in print via the `print:hidden` classes + globals.css.
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-soft print:hidden"
    >
      <Printer className="h-4 w-4" /> Download / Print PDF
    </button>
  );
}
