import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { getSetting } from "@/infrastructure/prisma/settings";
import { CopilotStudio } from "./CopilotStudio";

export const metadata = { title: "Copilot Voice · Alwalaa OS" };

export default async function CopilotSettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/");
  const persona = await getSetting("copilot");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-white/40 hover:text-gold">← Settings</Link>
        <h1 className="font-heading text-4xl text-white">Copilot Voice</h1>
        <p className="mt-1 text-white/50">Tone, personality and behavior of every department copilot. Saved live — no redeploy.</p>
      </div>
      <CopilotStudio initial={persona} />
    </div>
  );
}
