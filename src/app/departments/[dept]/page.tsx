import Link from "next/link";
import { notFound } from "next/navigation";
import * as Icons from "lucide-react";
import { DEPARTMENTS, getDepartment } from "../../_departments/config";
import { Copilot } from "./Copilot";

export const dynamicParams = false; // only the 5 known departments are valid

export function generateStaticParams() {
  return DEPARTMENTS.map((d) => ({ dept: d.id }));
}

export const metadata = { title: "Department · Alwalaa OS" };

export default function DepartmentPage({ params }: { params: { dept: string } }) {
  const dept = getDepartment(params.dept);
  if (!dept) notFound();
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[dept.icon] ?? Icons.LayoutGrid;

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

      <div className="flex flex-wrap gap-2">
        {DEPARTMENTS.filter((d) => d.id !== dept.id).map((d) => (
          <Link key={d.id} href={`/departments/${d.id}`} className="rounded-full border border-hairline px-3 py-1 text-xs text-white/55 hover:border-gold/40 hover:text-gold">
            {d.label}
          </Link>
        ))}
      </div>

      <Copilot department={dept.id} starters={dept.starters} />
    </div>
  );
}
