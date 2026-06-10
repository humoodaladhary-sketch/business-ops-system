import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Alwalaa Real Estate" };

export default function LoginPage() {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      {/* ambient gold glow */}
      <div className="pointer-events-none absolute -top-1/3 left-1/2 h-[55vh] w-[55vh] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />
      <div className="relative w-full max-w-sm rounded-3xl border border-hairline bg-ink-100/70 p-8 shadow-2xl backdrop-blur">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/alwalaa-logo.png"
            alt="Alwalaa Real Estate"
            width={220}
            height={280}
            className="h-24 w-auto"
            priority
          />
          <p className="mt-6 text-sm text-white/50">Sign in to your account</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
