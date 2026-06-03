/**
 * Print-friendly view of a comparison report.
 *
 * Use your browser's "Save as PDF" on this page — produces a clean
 * Alwalaa-branded PDF without requiring a heavyweight PDF library.
 *
 * Full @react-pdf/renderer integration lands in Milestone M4 polish.
 */

import { notFound } from "next/navigation";
import { getReport } from "@/lib/supabase/db";
import type { ComparisonReport } from "@/types";

export const dynamic = "force-dynamic";

export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = (await getReport(id)) as
    | {
        id: string;
        title: string | null;
        body_markdown: string | null;
        unit_ids: string[];
        created_at: string;
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
    <html lang="en">
      <head>
        <title>{report.title || "Alwalaa report"}</title>
        <style>{`
          @page { size: A4; margin: 14mm 16mm; }
          body { font-family: Georgia, serif; color: #0a0a0a; background: #fff; }
          header { border-bottom: 2px solid #D4A017; padding-bottom: 10px; margin-bottom: 20px;
                   display: flex; justify-content: space-between; align-items: flex-end; }
          h1 { font-size: 22pt; margin: 0; }
          .brand { font-weight: 700; letter-spacing: 2px; text-transform: uppercase; font-size: 10pt; color: #0a0a0a; }
          .brand small { color: #D4A017; font-weight: 400; display: block; }
          .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 1.5px; color: #6b6b6b; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; }
          th, td { border-bottom: 1px solid #e6e6e6; padding: 8px 6px; text-align: left; }
          th { background: #faf8f3; text-transform: uppercase; font-size: 8pt; letter-spacing: 1px; }
          .pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; font-size: 10pt; }
          .pros-cons ul { margin: 4px 0 0 18px; }
          .reco { border-left: 4px solid #D4A017; padding-left: 12px; margin: 20px 0; }
          .pitch { background: #faf8f3; padding: 14px; border-radius: 2px;
                   white-space: pre-wrap; font-family: monospace; font-size: 9pt; }
          footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e6e6e6;
                   font-size: 8pt; color: #6b6b6b; text-align: center; }
          .no-print { display: block; }
          @media print { .no-print { display: none; } }
        `}</style>
      </head>
      <body>
        <div className="no-print" style={{ padding: "10px 0", textAlign: "right" }}>
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.print();
            }}
            style={{ padding: "8px 14px", background: "#0A0A0A", color: "#fff", border: "none", cursor: "pointer" }}
          >
            🖨 Print / Save as PDF
          </button>
        </div>

        <header>
          <div>
            <h1>{report.title || "Comparison Report"}</h1>
            <div className="label" style={{ marginTop: 4 }}>
              Prepared for Humood Aladhari · {new Date(report.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="brand">
            Alwalaa
            <small>Real Estate</small>
          </div>
        </header>

        {report.input_filter?.clientBrief && (
          <p style={{ fontStyle: "italic", fontSize: "11pt", margin: "0 0 16px" }}>
            &ldquo;{report.input_filter.clientBrief}&rdquo;
          </p>
        )}

        {payload && (
          <>
            <div className="label">Comparison</div>
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  {payload.comparison.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.comparison.rows.map((row) => (
                  <tr key={row.unit_id}>
                    <td style={{ fontWeight: 600 }}>{row.title}</td>
                    {row.values.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {payload.comparison.rows.map((row) => (
              <div key={row.unit_id} style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: "11pt" }}>{row.title}</div>
                <div className="pros-cons">
                  <div>
                    <div className="label">Pros</div>
                    <ul>{row.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                  </div>
                  <div>
                    <div className="label">Cons</div>
                    <ul>{row.cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                </div>
              </div>
            ))}

            <div className="reco">
              <div className="label">Recommendation</div>
              <div style={{ fontFamily: "monospace", fontSize: "10pt", marginTop: 4 }}>
                {payload.recommendation.top_unit_id}
              </div>
              <p style={{ whiteSpace: "pre-line", marginTop: 8 }}>{payload.recommendation.reasoning}</p>
            </div>

            <div className="label">WhatsApp pitch</div>
            <div className="pitch">
              {payload.whatsapp_pitch.en}
              {"\n\n— — —\n\n"}
              {payload.whatsapp_pitch.ar}
            </div>
          </>
        )}

        <footer>
          Alwalaa Real Estate · Prepared for Humood Aladhari · All figures indicative and subject to change.
        </footer>
      </body>
    </html>
  );
}
