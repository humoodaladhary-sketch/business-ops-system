import Link from "next/link";
import * as Icons from "lucide-react";
import { DEPARTMENTS } from "../_departments/config";

export const metadata = { title: "Departments · Alwalaa OS" };

export default function DepartmentsHub() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl text-white">Departments</h1>
        <p className="mt-1 text-white/55">
          Each department has an AI copilot that knows its live data and can hand work to the others.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((d) => {
          const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[d.icon] ?? Icons.LayoutGrid;
          return (
            <Link
              key={d.id}
              href={`/departments/${d.id}`}
              className="group rounded-2xl border border-hairline bg-ink-100/50 p-5 transition hover:border-gold/40"
            >
              <span className={`grid h-12 w-12 place-items-center rounded-xl border border-hairline bg-ink-900/50 ${d.accent}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-heading text-xl text-white">{d.label}</h2>
              <p className="mt-1 text-sm text-white/50">{d.blurb}</p>
              <span className="mt-4 inline-block text-sm text-gold/80 group-hover:text-gold">Open copilot →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
