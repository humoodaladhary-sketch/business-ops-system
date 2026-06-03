import Link from "next/link";
import { getOrCreateDefaultOrgId, listReports } from "@/lib/supabase/db";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  let reports: Array<{ id: string; type: string; title: string | null; created_at: string; unit_ids: string[] }> = [];
  let error: string | null = null;
  try {
    const org = await getOrCreateDefaultOrgId();
    reports = (await listReports(org)) as typeof reports;
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Reports</h1>
          <p className="text-sm text-[var(--color-brand-gray-500)] mt-1">
            Comparison reports, investor pitches, and branded PDF exports.
          </p>
        </div>
        <Link href="/reports/new" className="btn-gold">+ New Comparison Report</Link>
      </header>

      {error && (
        <div className="card p-4 text-sm text-red-800 border-red-300">
          <strong>Supabase error:</strong> {error}
        </div>
      )}

      {reports.length === 0 && !error && (
        <section className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
          No reports yet. Build your first comparison report above.
        </section>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <Link
            key={r.id}
            href={`/reports/${r.id}`}
            className="card p-5 hover:border-[var(--color-brand-black)] transition block"
          >
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div>
                <span className="badge badge-gold">{r.type}</span>
                <div className="font-display text-lg mt-2">
                  {r.title || `${r.type} report`}
                </div>
                <div className="text-xs text-[var(--color-brand-gray-500)] mt-1">
                  {r.unit_ids?.length ?? 0} unit(s) · {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-xs text-[var(--color-brand-gold)] uppercase tracking-wider">Open →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
