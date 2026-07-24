export default function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <div className="flex items-center gap-2 text-white/40">
        <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}
