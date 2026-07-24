import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <h1 className="font-heading text-5xl text-gold">404</h1>
        <p className="mt-2 text-sm text-white/50">That page doesn&apos;t exist.</p>
        <Link href="/" className="mt-5 inline-block rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-gold hover:bg-gold/20">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
