import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { Card } from "../components/ui";

export const metadata = { title: "Settings · Alwalaa OS" };

const SECTIONS = [
  { href: "/settings/commission", title: "Commission Studio", sub: "Performance ladder, developer rates, lead-source floors." },
  { href: "/settings/targets", title: "Targets", sub: "Monthly sales target per advisor." },
  { href: "/admin/users", title: "User Access", sub: "Create logins — email, password, role." },
  { href: "/inventory", title: "Inventory", sub: "Units across off-plan & secondary, publish to feeds." },
];

export default async function SettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-heading text-4xl text-white">Settings</h1>
        <p className="mt-1 text-white/50">Configure the business rules — commission, targets, access and inventory.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition hover:border-gold/40">
              <h3 className="font-heading text-xl text-gold">{s.title}</h3>
              <p className="mt-1 text-sm text-white/50">{s.sub}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
