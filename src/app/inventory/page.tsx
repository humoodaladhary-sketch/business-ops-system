import Link from "next/link";
import { getOrCreateDefaultOrgId, listUnits } from "@/lib/supabase/db";
import type { Unit } from "@/types";

export const dynamic = "force-dynamic";

function fmtPrice(omr: number | null) {
  return omr == null ? "—" : `OMR ${omr.toLocaleString("en-US")}`;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ itc?: string }>;
}) {
  const sp = await searchParams;
  const onlyItc = sp.itc === "1";

  let units: Unit[] = [];
  let error: string | null = null;
  try {
    const org = await getOrCreateDefaultOrgId();
    units = await listUnits({ organization_id: org, onlyItc });
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl">Inventory</h1>
          <p className="text-sm text-[var(--color-brand-gray-500)] mt-1">
            {units.length} unit{units.length === 1 ? "" : "s"}
            {onlyItc ? " · ITC freehold only" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={onlyItc ? "/inventory" : "/inventory?itc=1"}
            className={onlyItc ? "btn-gold" : "btn-ghost"}
          >
            {onlyItc ? "✓ ITC only" : "ITC only"}
          </Link>
          <Link href="/upload" className="btn-primary">+ New Project</Link>
        </div>
      </header>

      {error && (
        <div className="card p-4 text-sm text-red-800 border-red-300">
          <strong>Supabase error:</strong> {error}
          <br />
          <span className="text-[var(--color-brand-gray-500)]">
            Check that your Supabase env vars are set and the schema is applied (see docs/DEPLOY.md).
          </span>
        </div>
      )}

      {units.length === 0 && !error && (
        <section className="card p-10 text-center">
          <div className="font-display text-xl mb-2">No units yet</div>
          <p className="text-sm text-[var(--color-brand-gray-500)] mb-6">
            Upload a project to populate the inventory.
          </p>
          <Link href="/upload" className="btn-gold">+ Upload your first project</Link>
        </section>
      )}

      <div className="space-y-3">
        {units.map((u) => (
          <Link
            key={u.id}
            href={`/units/${u.id}`}
            className="card p-5 hover:border-[var(--color-brand-black)] transition block"
          >
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div>
                <div className="font-mono text-xs text-[var(--color-brand-gray-500)]">
                  {u.reference_id}
                </div>
                <div className="font-display text-xl mt-1">
                  {u.bedrooms ?? "?"}BR {u.unit_type.replace("_", " ")}
                  {u.building ? ` · ${u.building}` : ""}
                </div>
                <div className="text-sm text-[var(--color-brand-gray-500)] mt-1">
                  {u.area_sqm ? `${u.area_sqm} sqm` : ""}
                  {u.floor ? ` · Floor ${u.floor}` : ""}
                  {u.view ? ` · ${u.view}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl">{fmtPrice(u.price_omr)}</div>
                {u.ownership_type === "freehold_itc" && (
                  <span className="badge badge-gold mt-1">Freehold (ITC)</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
