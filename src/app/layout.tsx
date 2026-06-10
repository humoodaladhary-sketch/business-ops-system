import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/infrastructure/auth/session";
import { Shell, type ShellUser } from "./components/Shell";

export const metadata: Metadata = {
  title: "Alwalaa OS — Advisory Operations",
  description:
    "Leads, agent performance, commissions and performance-based payouts for Alwalaa Real Estate.",
};

const BASE = [
  { href: "/", label: "Overview" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/deals", label: "Deals" },
  { href: "/performance", label: "Performance" },
  { href: "/analytics", label: "Analytics" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/portal", label: "Agent Portal" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const links = [...BASE];
  if (session?.role === "ADMIN") {
    links.splice(7, 0, { href: "/agents", label: "Agents" });
    links.push({ href: "/admin/users", label: "User Access" });
  } else if (session?.agentId) {
    links.splice(7, 0, { href: `/agents/${session.agentId}`, label: "My Workspace" });
  }

  const user: ShellUser | null = session
    ? { name: session.name, role: session.role, agentId: session.agentId }
    : null;

  return (
    <html lang="en">
      <body>
        <Shell links={links} user={user}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
