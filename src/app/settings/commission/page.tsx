import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { CommissionStudio } from "./CommissionStudio";

export const metadata = { title: "Commission Studio · Alwalaa OS" };

export default async function CommissionSettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-white/40 hover:text-gold">← Settings</Link>
        <h1 className="font-heading text-4xl text-white">Commission Studio</h1>
        <p className="mt-1 text-white/50">
          Tune the ladder, developer rates and source floors — changes apply to the live tier-progress and payout projections immediately.
        </p>
      </div>
      <CommissionStudio />
    </div>
  );
}
