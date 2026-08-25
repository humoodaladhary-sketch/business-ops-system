import { Suspense } from "react";
import { UnlockForm } from "./UnlockForm";

export const metadata = { title: "Unlock · Alwalaa OS" };

export default function UnlockPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <h1 className="font-heading text-3xl text-white">Alwalaa OS</h1>
      <p className="mt-1 mb-6 text-sm text-white/50">Enter the owner passcode to continue.</p>
      <Suspense fallback={null}>
        <UnlockForm />
      </Suspense>
    </div>
  );
}
