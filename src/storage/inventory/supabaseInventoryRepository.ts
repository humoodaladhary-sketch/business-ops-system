/**
 * Supabase adapter. Backs the two tables defined in
 * docs/DEV_INVENTORY_SCHEMA.sql:
 *   - dev_units         (one row per canonical Unit, keyed by id)
 *   - dev_price_movements
 *
 * Uses the existing service-role server client (lib/supabase/server.ts) —
 * no second client, no new env vars.
 */

import { supabaseServer } from "@/lib/supabase/server";
import { UnitSchema, type Unit } from "@/domain/inventory/unit";
import {
  diffInventory,
  PriceMovementSchema,
  type InventoryRepository,
  type PriceMovement,
  type UpsertReport,
} from "./InventoryRepository";

// DB row uses snake_case to match the rest of the Postgres schema.
interface UnitRow {
  id: string;
  project: string;
  developer: string;
  unit_ref: string;
  unit_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  floor: string | null;
  view: string | null;
  price_omr: number | null;
  price_per_sqm: number | null;
  status: string;
  payment_plan: string | null;
  handover_date: string | null;
  itc_eligible: boolean;
  furnishing: string | null;
  source_raw: string;
  imported_at: string;
  notes: string | null;
}

function toRow(u: Unit): UnitRow {
  return {
    id: u.id,
    project: u.project,
    developer: u.developer,
    unit_ref: u.unitRef,
    unit_type: u.unitType,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    size_sqm: u.sizeSqm,
    floor: u.floor,
    view: u.view,
    price_omr: u.priceOMR,
    price_per_sqm: u.pricePerSqm,
    status: u.status,
    payment_plan: u.paymentPlan,
    handover_date: u.handoverDate,
    itc_eligible: u.itcEligible,
    furnishing: u.furnishing,
    source_raw: u.sourceRaw,
    imported_at: u.importedAt,
    notes: u.notes,
  };
}

function fromRow(r: UnitRow): Unit {
  return UnitSchema.parse({
    id: r.id,
    project: r.project,
    developer: r.developer,
    unitRef: r.unit_ref,
    unitType: r.unit_type,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    sizeSqm: r.size_sqm,
    floor: r.floor,
    view: r.view,
    priceOMR: r.price_omr,
    pricePerSqm: r.price_per_sqm,
    status: r.status,
    paymentPlan: r.payment_plan,
    handoverDate: r.handover_date,
    itcEligible: r.itc_eligible,
    furnishing: r.furnishing,
    sourceRaw: r.source_raw,
    importedAt: r.imported_at,
    notes: r.notes,
  });
}

export class SupabaseInventoryRepository implements InventoryRepository {
  async getAll(): Promise<Unit[]> {
    const sb = supabaseServer();
    const { data, error } = await sb.from("dev_units").select("*");
    if (error) throw new Error(`dev_units select failed: ${error.message}`);
    return (data ?? []).map((r) => fromRow(r as UnitRow));
  }

  async upsertMany(units: Unit[]): Promise<UpsertReport> {
    const sb = supabaseServer();
    const existingUnits = await this.getAll();
    const existing = new Map(existingUnits.map((u) => [u.id, u]));
    const diff = diffInventory(existing, units);

    const { error: upsertErr } = await sb
      .from("dev_units")
      .upsert(units.map(toRow), { onConflict: "id" });
    if (upsertErr) throw new Error(`dev_units upsert failed: ${upsertErr.message}`);

    if (diff.movements.length > 0) {
      await this.appendMovements(diff.movements);
    }

    return {
      inserted: diff.inserted,
      updated: diff.updated,
      unchanged: diff.unchanged,
      movements: diff.movements,
    };
  }

  async getHistory(): Promise<PriceMovement[]> {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from("dev_price_movements")
      .select("*")
      .order("at", { ascending: false });
    if (error) throw new Error(`dev_price_movements select failed: ${error.message}`);
    return (data ?? []).map((r) =>
      PriceMovementSchema.parse({
        id: (r as Record<string, unknown>).unit_id,
        project: (r as Record<string, unknown>).project,
        unitRef: (r as Record<string, unknown>).unit_ref,
        oldPrice: (r as Record<string, unknown>).old_price,
        newPrice: (r as Record<string, unknown>).new_price,
        deltaPct: (r as Record<string, unknown>).delta_pct,
        at: (r as Record<string, unknown>).at,
      }),
    );
  }

  async appendMovements(movements: PriceMovement[]): Promise<void> {
    if (movements.length === 0) return;
    const sb = supabaseServer();
    const rows = movements.map((m) => ({
      unit_id: m.id,
      project: m.project,
      unit_ref: m.unitRef,
      old_price: m.oldPrice,
      new_price: m.newPrice,
      delta_pct: m.deltaPct,
      at: m.at,
    }));
    const { error } = await sb.from("dev_price_movements").insert(rows);
    if (error) throw new Error(`dev_price_movements insert failed: ${error.message}`);
  }
}
