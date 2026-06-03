import type { Metadata } from "next";
import "./globals.css";
import { BrandFooter, BrandHeader } from "@/components/brand/BrandHeader";

export const metadata: Metadata = {
  title: "Alwalaa AI Listing Agent",
  description: "Private real-estate intelligence system for Alwalaa Real Estate (Sultanate of Oman).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BrandHeader />
        <main className="mx-auto max-w-7xl px-6 py-10 min-h-[calc(100vh-10rem)]">{children}</main>
        <BrandFooter />
      </body>
    </html>
  );
}
