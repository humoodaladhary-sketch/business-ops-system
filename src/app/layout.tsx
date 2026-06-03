import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./components/Nav";

// Fonts (Cormorant Garamond headings · Inter body) are loaded at runtime via a
// CSS @import in globals.css, so the production build never needs network for
// font fetching. CSS variables --font-cormorant / --font-inter are defined there.

export const metadata: Metadata = {
  title: "Alwalaa CRM — Advisory Operations",
  description:
    "Leads, agent performance, commissions and performance-based payouts for Alwalaa Real Estate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-7xl px-6 pb-10 pt-4 text-xs text-white/30">
          Alwalaa Real Estate · Muscat, Oman — internal advisory operations system.
        </footer>
      </body>
    </html>
  );
}
