import Link from "next/link";
import { getOrCreateDefaultOrgId, listUnits } from "@/lib/supabase/db";
import { ComparisonBuilder } from "./ComparisonBuilder";

export const dynamic = "force-dynamic";

export default async function NewComparisonPage() {
  let units: Awaited<ReturnType<typeof listUnits>> = [];
  try {
    const org = await getOrCreateDefaultOrgId();
    units = await listUnits({ organization_id: org });
  } catch {
    // RLS/schema not set up yet — fall through and show the empty-state CTA
  }

  if (units.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl">New comparison report</h1>
        <div className="card p-10 text-center text-sm text-[var(--color-brand-gray-500)]">
          You need at least 2 units in inventory to build a comparison report.
          <br />
          <Link href="/upload" className="btn-gold mt-4 inline-block">Upload a project</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/reports" className="btn-ghost text-sm">← Back to reports</Link>
      <h1 className="font-display text-3xl">New comparison report</h1>
      <ComparisonBuilder
        units={units.map((u) => ({
          id: u.id,
          reference_id: u.reference_id,
          unit_type: u.unit_type,
          bedrooms: u.bedrooms,
          area_sqm: u.area_sqm,
          price_omr: u.price_omr,
          ownership_type: u.ownership_type,
        }))}
      />
    </div>
  );
}
