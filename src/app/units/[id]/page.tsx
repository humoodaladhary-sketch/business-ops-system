import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBuyer,
  getRoi,
  getUnit,
  listListings,
  listUnitFields,
} from "@/lib/supabase/db";
import { UnitTabs } from "./UnitTabs";

export const dynamic = "force-dynamic";

function fmtPrice(omr: number | null) {
  return omr == null ? "—" : `OMR ${omr.toLocaleString("en-US")}`;
}

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const unit = await getUnit(id);
  if (!unit) notFound();

  const [roi, buyer, fields, listings] = await Promise.all([
    getRoi(id),
    getBuyer(id),
    listUnitFields(id),
    listListings(id),
  ]);

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/inventory" className="btn-ghost">← Back to inventory</Link>
      </div>

      <header className="card p-6">
        <div className="flex flex-wrap justify-between items-start gap-6">
          <div>
            <div className="font-mono text-xs text-[var(--color-brand-gray-500)]">
              {unit.reference_id}
            </div>
            <h1 className="font-display text-3xl mt-1">
              {unit.bedrooms ?? "?"}BR {unit.unit_type.replace("_", " ")}
              {unit.building ? ` · ${unit.building}` : ""}
              {unit.floor ? ` · Floor ${unit.floor}` : ""}
            </h1>
            <p className="text-sm text-[var(--color-brand-gray-500)] mt-2">
              {unit.area_sqm ? `${unit.area_sqm} sqm` : ""}
              {unit.bathrooms ? ` · ${unit.bathrooms} BA` : ""}
              {unit.view ? ` · ${unit.view}` : ""}
              {unit.parking ? ` · ${unit.parking} parking` : ""}
            </p>
            {unit.payment_plan && (
              <p className="text-xs text-[var(--color-brand-gray-500)] mt-2">
                Payment plan: {unit.payment_plan}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="font-display text-2xl">{fmtPrice(unit.price_omr)}</div>
            {unit.ownership_type === "freehold_itc" && (
              <span className="badge badge-gold mt-2">Freehold (ITC) · Foreign buyers eligible</span>
            )}
            {unit.handover_date && (
              <div className="text-xs text-[var(--color-brand-gray-500)] mt-2">
                Handover {new Date(unit.handover_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </header>

      <UnitTabs
        unit={unit}
        roi={roi}
        buyer={buyer}
        fields={fields}
        listings={listings}
      />
    </div>
  );
}
