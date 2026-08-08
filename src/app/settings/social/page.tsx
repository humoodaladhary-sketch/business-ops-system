import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/infrastructure/auth/session";
import { SocialStudio } from "./SocialStudio";

export const metadata = { title: "Social Connections · Alwalaa OS" };

export default async function SocialSettingsPage() {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="text-sm text-white/40 hover:text-gold">← Settings</Link>
        <h1 className="font-heading text-4xl text-white">Social Connections</h1>
        <p className="mt-1 text-white/50">
          Connect Alwalaa&apos;s accounts to the OS, then compose, dry-run and publish from one place.
          Tokens are stored server-side only; nothing ever posts without a passed dry run.
        </p>
      </div>
      <SocialStudio />
    </div>
  );
}
