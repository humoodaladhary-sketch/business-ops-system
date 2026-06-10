import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Alwalaa OS" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-hairline bg-ink-100/60 p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/alwalaa-logo.png" alt="Alwalaa Real Estate" width={150} height={190} className="h-20 w-auto" priority />
          <h1 className="mt-4 font-heading text-2xl text-white">Alwalaa OS</h1>
          <p className="text-sm text-white/45">Sign in to your account</p>
        </div>
        <LoginForm />
        <p className="mt-5 text-center text-[11px] text-white/30">
          Access is provisioned by your administrator.
        </p>
      </div>
    </div>
  );
}
