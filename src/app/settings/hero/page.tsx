import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { HeroStudio } from "./HeroStudio";

export const metadata = { title: "Hero & Media · Alwalaa OS" };

export default async function HeroSettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-white/40 hover:text-gold">← Settings</Link>
        <h1 className="font-heading text-4xl text-white">Hero &amp; Media</h1>
        <p className="mt-1 text-white/50">
          Curate the Command Portal banner: upload licensed imagery, approve it, set focal points, and
          schedule editorial slides. Unlicensed or unapproved images can never publish.
        </p>
      </div>
      <HeroStudio />
    </div>
  );
}
