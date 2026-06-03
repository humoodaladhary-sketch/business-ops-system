/**
 * Persistence boundary for developer inventory. The domain + AI layers never
 * touch storage directly — they go through this interface, so the same logic
 * runs against Supabase (this app), an in-memory store (tests / N8N preview),
 * or any future adapter.
 */

import { z } from "zod";
import type { Unit } from "@/domain/inventory/unit";

// ---------------------------------------------------------------------------
// Price movement (the source of all "price increase" insight)
// ---------------------------------------------------------------------------

export const PriceMovementSchema = z.object({
  id: z.string(), // unit id
  project: z.string(),
  unitRef: z.string(),
  oldPrice: z.number(),
  newPrice: z.number(),
  deltaPct: z.number(),
  at: z.string(), // ISO
});
export type PriceMovement = z.infer<typeof PriceMovementSchema>;

// ---------------------------------------------------------------------------
// Upsert result — what changed on commit
// ---------------------------------------------------------------------------

export interface UpsertReport {
  inserted: number;
  updated: number;
  unchanged: number;
  movements: PriceMovement[];
}

export interface InventoryRepository {
  /** All stored units. */
  getAll(): Promise<Unit[]>;

  /**
   * Insert or update units by `id`. Detects price changes against stored
   * values and appends a PriceMovement for each change.
   */
  upsertMany(units: Unit[]): Promise<UpsertReport>;

  /** Full price-movement history (optionally newest-first). */
  getHistory(): Promise<PriceMovement[]>;

  /** Append movements directly (used internally; exposed for adapters/tests). */
  appendMovements(movements: PriceMovement[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Shared helper: compute movements + classify each incoming unit
// ---------------------------------------------------------------------------

export interface DiffResult {
  toWrite: Unit[];
  movements: PriceMovement[];
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * Pure diff of incoming units against an existing snapshot keyed by id.
 * Adapters call this so movement-detection logic lives in one place.
 */
export function diffInventory(
  existing: Map<string, Unit>,
  incoming: Unit[],
  at: string = new Date().toISOString(),
): DiffResult {
  const movements: PriceMovement[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const unit of incoming) {
    const prev = existing.get(unit.id);
    if (!prev) {
      inserted += 1;
      continue;
    }
    const priceChanged =
      prev.priceOMR != null &&
      unit.priceOMR != null &&
      prev.priceOMR !== unit.priceOMR;

    if (priceChanged) {
      updated += 1;
      const deltaPct =
        prev.priceOMR! > 0
          ? Math.round(((unit.priceOMR! - prev.priceOMR!) / prev.priceOMR!) * 1000) / 10
          : 0;
      movements.push({
        id: unit.id,
        project: unit.project,
        unitRef: unit.unitRef,
        oldPrice: prev.priceOMR!,
        newPrice: unit.priceOMR!,
        deltaPct,
        at,
      });
    } else if (JSON.stringify(prev) !== JSON.stringify({ ...unit, importedAt: prev.importedAt })) {
      // Non-price field changed (status, notes, etc.)
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  return { toWrite: incoming, movements, inserted, updated, unchanged };
}

// ---------------------------------------------------------------------------
// Preview diff (for the Ingest UI — new vs price-changed vs unchanged)
// ---------------------------------------------------------------------------

export type PreviewKind = "new" | "price-changed" | "changed" | "unchanged";

export interface PreviewRow {
  unit: Unit;
  kind: PreviewKind;
  oldPrice: number | null;
  deltaPct: number | null;
}

export function previewDiff(existing: Map<string, Unit>, incoming: Unit[]): PreviewRow[] {
  return incoming.map((unit) => {
    const prev = existing.get(unit.id);
    if (!prev) return { unit, kind: "new" as const, oldPrice: null, deltaPct: null };
    const priceChanged =
      prev.priceOMR != null && unit.priceOMR != null && prev.priceOMR !== unit.priceOMR;
    if (priceChanged) {
      const deltaPct =
        prev.priceOMR! > 0
          ? Math.round(((unit.priceOMR! - prev.priceOMR!) / prev.priceOMR!) * 1000) / 10
          : 0;
      return { unit, kind: "price-changed" as const, oldPrice: prev.priceOMR, deltaPct };
    }
    const otherChanged =
      JSON.stringify({ ...prev, importedAt: "" }) !== JSON.stringify({ ...unit, importedAt: "" });
    return {
      unit,
      kind: otherChanged ? ("changed" as const) : ("unchanged" as const),
      oldPrice: prev.priceOMR,
      deltaPct: null,
    };
  });
}
