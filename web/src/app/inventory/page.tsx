export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Inventory</h1>
        <p className="text-sm text-[var(--color-brand-gray-500)] mt-1">
          Every unit extracted from your uploaded projects. Filter, score, and generate listings in one click.
        </p>
      </header>

      <section className="card p-10 text-center">
        <div className="font-display text-xl mb-2">No units yet</div>
        <p className="text-sm text-[var(--color-brand-gray-500)] mb-6">
          Units appear here automatically after you run <strong>Upload → Extract</strong>.
        </p>
        <a href="/upload" className="btn-gold">+ Upload your first project</a>
      </section>

      <section className="card p-6 text-sm text-[var(--color-brand-gray-500)]">
        <strong className="text-[var(--color-brand-black)]">Coming in Milestone M1 (see docs/MVP_BUILD_PLAN.md):</strong>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Unit list with source-badged fields</li>
          <li>Filters: ITC-only, yield ≥ %, bedrooms, price range, project</li>
          <li>Bulk &quot;Generate all listings&quot; across filtered selection</li>
        </ul>
      </section>
    </div>
  );
}
