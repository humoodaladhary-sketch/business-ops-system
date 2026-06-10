import Image from "next/image";
import { SetupForm } from "./SetupForm";

export const metadata = { title: "First-time setup · Alwalaa OS" };

// One-time guided go-live: creates the Super Admin account and seeds the
// commission config. Safe to expose — the POST is gated by INTERNAL_API_TOKEN
// and re-running is idempotent.
export default function SetupPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-ink-100/60 p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/alwalaa-logo.png" alt="Alwalaa Real Estate" width={150} height={190} className="h-16 w-auto" priority />
          <h1 className="mt-4 font-heading text-2xl text-white">First-time setup</h1>
          <p className="mt-1 text-sm text-white/45">
            Create your Super Admin account and seed the system — one click, done once.
          </p>
        </div>
        <SetupForm />
        <p className="mt-5 text-center text-[11px] text-white/30">
          Already set up? <a href="/login" className="text-gold/70 underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
