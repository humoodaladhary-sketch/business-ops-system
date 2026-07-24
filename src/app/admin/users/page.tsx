import { redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { adminConfigured } from "@/infrastructure/auth/admin";
import { loadData } from "../../_data/source";
import { Card, SectionTitle, Badge } from "../../components/ui";
import { CreateUserForm } from "./CreateUserForm";

export const metadata = { title: "User Access · Alwalaa OS" };

export default async function UsersAdminPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/");

  const data = await loadData();
  const agents = data.agents
    .filter((a) => ["SENIOR", "ADVISOR", "NEW", "TRAINEE"].includes(a.role) && a.status !== "FORMER")
    .map((a) => ({ id: a.id, name: a.name }));
  const live = adminConfigured();

  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-heading text-4xl text-white">User Access</h1>
        <p className="mt-1 text-white/50">Provision logins for your team. You (Super Admin) create each account&apos;s email + password.</p>
      </div>

      <Card className={live ? "" : "border-amber-400/30 bg-amber-500/5"}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/70">
            {live ? "Connected — logins are created in Supabase Auth." : "Preview mode — connect Supabase to provision real logins."}
          </span>
          <Badge variant={live ? "good" : "watch"}>{live ? "Live" : "Needs database"}</Badge>
        </div>
        {!live && (
          <p className="mt-2 text-xs text-white/45">
            Set <code className="text-white/70">AUTH_PROVIDER=supabase</code> + the Supabase URL/keys (see{" "}
            <code className="text-white/70">docs/GO-LIVE.md</code>). Until then, preview sign-in uses a shared password.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle sub="Email is the username; the user changes the password on first sign-in (when live).">Create a login</SectionTitle>
          <Card>
            <CreateUserForm agents={agents} />
          </Card>
        </div>
        <div>
          <SectionTitle sub="Advisors an AGENT login can be linked to.">Team</SectionTitle>
          <Card className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-white/80">{a.name}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-white/40">{a.id}@alwalaaoman.com</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
