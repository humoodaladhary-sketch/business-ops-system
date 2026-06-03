import Image from "next/image";
import { AGENTS } from "../_data/dataset";
import { isSupabaseConfigured } from "@/infrastructure/auth/session";
import { SupabaseLogin } from "./SupabaseLogin";

export const metadata = { title: "Sign in · Alwalaa CRM" };

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const agents = AGENTS.filter((a) => a.status !== "FORMER" && ["SENIOR", "ADVISOR", "NEW", "TRAINEE"].includes(a.role));

  return (
    <div className="grid min-h-[78vh] place-items-center">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-ink-100/60 p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/alwalaa-logo.png" alt="Alwalaa Real Estate" width={150} height={190} className="h-20 w-auto" priority />
          <h1 className="mt-4 text-2xl text-white">Advisory Operations</h1>
          <p className="text-sm text-white/45">Sign in to continue</p>
        </div>

        {configured ? (
          <SupabaseLogin />
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-white/40">Administration</div>
              <a href="/api/auth/demo?who=ceo" className="block w-full rounded-md bg-gold px-4 py-2.5 text-center font-medium text-ink hover:bg-gold-soft">
                Continue as CEO / Admin
              </a>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-white/40">Advisors</div>
              <div className="grid grid-cols-2 gap-2">
                {agents.map((a) => (
                  <a key={a.id} href={`/api/auth/demo?who=${a.id}`} className="rounded-md border border-hairline bg-ink-900/40 px-3 py-2 text-center text-sm text-white/80 hover:border-gold/40 hover:text-gold">
                    {a.name}
                  </a>
                ))}
              </div>
            </div>
            <p className="pt-1 text-center text-[11px] text-white/30">
              Preview sign-in. Production uses Supabase email auth + database row-level security.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
