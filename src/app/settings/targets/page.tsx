import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { loadData } from "../../_data/source";
import { TargetsEditor } from "./TargetsEditor";

export const metadata = { title: "Targets · Alwalaa OS" };

export default async function TargetsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/");

  const data = await loadData();
  const agents = data.agents
    .filter((a) => ["SENIOR", "ADVISOR", "NEW"].includes(a.role) && a.status !== "FORMER")
    .map((a) => ({ id: a.id, name: a.name, role: a.role, target: a.target }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-white/40 hover:text-gold">← Settings</Link>
        <h1 className="font-heading text-4xl text-white">Monthly Targets</h1>
        <p className="mt-1 text-white/50">Per-advisor monthly sales target — drives % of target, the ladder tier and at-risk flags.</p>
      </div>
      <TargetsEditor agents={agents} />
    </div>
  );
}
