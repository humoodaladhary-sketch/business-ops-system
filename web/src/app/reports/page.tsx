export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Reports</h1>
        <p className="text-sm text-[var(--color-brand-gray-500)] mt-1">
          Comparison reports, investor pitches, and branded PDF exports.
        </p>
      </header>

      <section className="card p-10 text-center">
        <div className="font-display text-xl mb-2">No reports yet</div>
        <p className="text-sm text-[var(--color-brand-gray-500)] mb-6">
          Build a comparison report from your inventory, or an investor pitch for a single unit.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/inventory" className="btn-primary">Browse inventory</a>
          <button className="btn-gold" disabled>+ New Comparison Report</button>
        </div>
        <p className="text-xs text-[var(--color-brand-gray-500)] mt-4">
          Report builder UI lands in Milestone M4.
        </p>
      </section>
    </div>
  );
}
