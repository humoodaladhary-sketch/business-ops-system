"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <h1 className="font-heading text-3xl text-gold">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/50">An unexpected error occurred. Please try again.</p>
        <button onClick={() => reset()} className="mt-5 rounded-md bg-gold px-4 py-2 font-medium text-ink hover:bg-gold-soft">
          Retry
        </button>
      </div>
    </div>
  );
}
