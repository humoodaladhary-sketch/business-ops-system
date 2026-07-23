import Link from "next/link";
import { notFound } from "next/navigation";
import * as Icons from "lucide-react";
import { DEPARTMENTS, getDepartment } from "../../_departments/config";
import { deptApi } from "@/lib/deptApi";
import { formatOMR } from "../../lib/format";
import { Copilot } from "./Copilot";

export const dynamic = "force-dynamic";
export const metadata = { title: "Department · Alwalaa OS" };

interface Snapshot {
  kpis?: { label: string; value: number; money?: boolean }[];
  chips?: Record<string, number>;
  table?: { title: string; columns: string[]; rows: Record<string, unknown>[] } | null;
  error?: string;
}

const cell = (col: string, v: unknown) => {
  if (v == null) return "—";
  if (/omr/i.test(col) && !isNaN(Number(v))) return formatOMR(Number(v));
  return String(v);
};

export default async function DepartmentPage({ params }: { params: { dept: string } }) {
  const dept = getDepartment(params.dept);
  if (!dept) notFound();
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[dept.icon] ?? Icons.LayoutGrid;

  let snap: Snapshot = {};
  try {
    snap = await deptApi<Snapshot>({ action: "data", department: dept.id });
  } catch {
    snap = { error: "unreachable" };
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/departments" className="text-sm text-white/40 hover:text-gold">← Departments</Link>
        <div className="mt-1 flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-ink-900/50 ${dept.accent}`}>
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-heading text-3xl text-white">{dept.label}</h1>
            <p className="text-sm text-white/50">{dept.blurb}</p>
          </div>
        </div>
      </div>

      {/* Live snapshot */}
      {snap.kpis && snap.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {snap.kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-hairline bg-ink-100/50 p-4">
              <div className="text-[11px] uppercase tracking-wide text-white/45">{k.label}</div>
              <div className="mt-1 text-2xl font-bold text-white">{k.money ? formatOMR(k.value, true) : k.value}</div>
            </div>
          ))}
        </div>
      )}

      {snap.chips && Object.keys(snap.chips).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(snap.chips).map(([k, v]) => (
            <span key={k} className="rounded-md border border-hairline bg-ink-900/40 px-3 py-1 text-xs text-white/70">
              <span className="font-semibold text-white">{v}</span> <span className="text-white/50">{k.replace(/_/g, " ")}</span>
            </span>
          ))}
        </div>
      )}

      {snap.table && snap.table.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-ink-100/40">
          <div className="border-b border-hairline px-4 py-2 text-sm font-medium text-white/70">{snap.table.title}</div>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {snap.table.columns.map((c) => (
                  <th key={c} className="px-4 py-2 text-left text-[11px] uppercase tracking-wide text-white/40">{c.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snap.table.rows.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  {snap.table!.columns.map((c) => (
                    <td key={c} className="px-4 py-2 text-white/80">{cell(c, r[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {snap.error && <p className="text-xs text-white/40">Live data couldn&apos;t load right now — the copilot below still works once its key is set.</p>}

      {/* Copilot */}
      <div className="pt-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-lg text-white">Copilot</h2>
          <div className="flex flex-wrap gap-1.5">
            {DEPARTMENTS.filter((d) => d.id !== dept.id).map((d) => (
              <Link key={d.id} href={`/departments/${d.id}`} className="rounded-full border border-hairline px-2.5 py-1 text-xs text-white/55 hover:border-gold/40 hover:text-gold">
                {d.label}
              </Link>
            ))}
          </div>
        </div>
        <Copilot department={dept.id} starters={dept.starters} />
      </div>
    </div>
  );
}
