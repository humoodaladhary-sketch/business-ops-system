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
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/portal", label: "Assignment" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/deals", label: "Deals" },
  { href: "/inventory", label: "Inventory" },
  { href: "/performance", label: "Performance" },
  { href: "/analytics", label: "Analytics" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const links = [...BASE];
  if (session?.role === "ADMIN") {
    links.push({ href: "/agents", label: "Agents" });
    links.push({ href: "/settings", label: "Settings" });
  } else if (session?.agentId) {
    links.push({ href: `/agents/${session.agentId}`, label: "My Workspace" });
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
