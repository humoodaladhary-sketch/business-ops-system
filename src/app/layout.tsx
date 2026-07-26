import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/infrastructure/auth/session";
import { Shell, type ShellUser } from "./components/Shell";
import { ProModeProvider } from "./components/ProMode";

export const metadata: Metadata = {
  title: "Alwalaa OS — Advisory Operations",
  description:
    "Leads, agent performance, commissions and performance-based payouts for Alwalaa Real Estate.",
};

const BASE = [
  { href: "/", label: "Dashboard" },
  { href: "/war-room", label: "Pro Mode" },
  { href: "/departments", label: "Departments" },
  { href: "/leads", label: "Leads" },
  { href: "/portal", label: "Assignment" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/deals", label: "Deals" },
  { href: "/inventory", label: "Inventory" },
  { href: "/performance", label: "Performance" },
  { href: "/analytics", label: "Analytics" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/reports", label: "Reports" },
];

// Set data-pro before paint so a saved War-Room session doesn't flash gold first.
const PRO_BOOT = `try{document.documentElement.dataset.pro=localStorage.getItem('alwalaa-pro')==='1'?'on':'off'}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Owner-only mode: no agent management, just the owner's workspace + settings.
  const links = [...BASE, { href: "/settings", label: "Settings" }];

  const user: ShellUser | null = session
    ? { name: session.name, role: session.role, agentId: session.agentId }
    : null;

  return (
    <html lang="en">
      <body>
        <script dangerouslySetInnerHTML={{ __html: PRO_BOOT }} />
        <ProModeProvider>
          <Shell links={links} user={user}>
            {children}
          </Shell>
        </ProModeProvider>
      </body>
    </html>
  );
}
