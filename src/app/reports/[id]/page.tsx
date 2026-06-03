import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/ui/CopyButton";
import { getReport } from "@/lib/supabase/db";
import type { ComparisonReport } from "@/types";

export const dynamic = "force-dynamic";

export default async function ReportViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = (await getReport(id)) as
    | {
        id: string;
        type: string;
        title: string | null;
        body_markdown: string | null;
        unit_ids: string[];
        created_at: string;
        whatsapp_pitch: string | null;
        input_filter: { clientBrief?: string } | null;
      }
    | null;
  if (!report) notFound();

  let payload: ComparisonReport | null = null;
  try {
    payload = report.body_markdown ? (JSON.parse(report.body_markdown) as ComparisonReport) : null;
  } catch {
    payload = null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href="/reports" className="btn-ghost text-sm">← Back to reports</Link>
        <div className="flex gap-2">
          <Link href={`/reports/${id}/print`} className="btn-primary text-xs" target="_blank">
            🖨 Print / Export PDF
          </Link>
          {report.whatsapp_pitch && (
            <CopyButton text={report.whatsapp_pitch} label="Copy WhatsApp pitch" />
          )}
        </div>
      </div>

      <header className="card p-6">
        <span className="badge badge-gold">{report.type}</span>
        <h1 className="font-display text-2xl mt-2">{report.title || "Comparison report"}</h1>
        <div className="text-xs text-[var(--color-brand-gray-500)] mt-1">
          {new Date(report.created_at).toLocaleString()} · {report.unit_ids.length} units
        </div>
        {report.input_filter?.clientBrief && (
          <p className="mt-3 text-sm italic">&ldquo;{report.input_filter.clientBrief}&rdquo;</p>
        )}
      </header>

      {payload && (
        <>
          <section className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-brand-gray-50)] text-left text-xs uppercase tracking-wider">
                  <th className="p-3">Unit</th>
                  {payload.comparison.columns.map((c) => (
                    <th key={c} className="p-3">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.comparison.rows.map((row) => (
                  <tr key={row.unit_id} className="border-t border-[var(--color-brand-gray-200)]">
                    <td className="p-3 font-medium">{row.title}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="p-3">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            {payload.comparison.rows.map((row) => (
              <div key={row.unit_id} className="card p-4">
                <div className="font-display text-lg mb-2">{row.title}</div>
                {row.pros.length > 0 && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)] mt-2">Pros</div>
                    <ul className="text-sm list-disc pl-5 mt-1">
                      {row.pros.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </>
                )}
                {row.cons.length > 0 && (
                  <>
                    <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)] mt-3">Cons</div>
                    <ul className="text-sm list-disc pl-5 mt-1">
                      {row.cons.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </>
                )}
              </div>
            ))}
          </section>

          <section className="card p-6 border-l-4 border-l-[var(--color-brand-gold)]">
            <div className="text-xs uppercase tracking-wider text-[var(--color-brand-gold)]">Recommendation</div>
            <div className="font-mono text-sm mt-1">{payload.recommendation.top_unit_id}</div>
            <p className="mt-3 whitespace-pre-line text-sm">{payload.recommendation.reasoning}</p>
          </section>

          <section className="card p-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-display text-lg">WhatsApp pitch</h2>
              <CopyButton text={`${payload.whatsapp_pitch.en}\n\n— — —\n\n${payload.whatsapp_pitch.ar}`} />
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm bg-[var(--color-brand-gray-50)] p-4 rounded-sm">
              {payload.whatsapp_pitch.en}
              {"\n\n— — —\n\n"}
              {payload.whatsapp_pitch.ar}
            </pre>
          </section>
        </>
      )}
    </div>
  );
}
