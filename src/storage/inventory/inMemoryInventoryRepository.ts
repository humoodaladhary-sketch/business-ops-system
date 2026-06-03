/**
 * In-memory adapter. Used for tests, local runs without Supabase env vars,
 * and N8N preview calls. Process-lifetime only — not durable.
 *
 * A module-level store is used so the same instance survives across requests
 * within one server process (Next dev / a single serverless warm instance).
 */

import type { Unit } from "@/domain/inventory/unit";
import {
  diffInventory,
  type InventoryRepository,
  type PriceMovement,
  type UpsertReport,
} from "./InventoryRepository";

const unitStore = new Map<string, Unit>();
const movementStore: PriceMovement[] = [];

export class InMemoryInventoryRepository implements InventoryRepository {
  async getAll(): Promise<Unit[]> {
    return Array.from(unitStore.values());
  }

  async upsertMany(units: Unit[]): Promise<UpsertReport> {
    const diff = diffInventory(unitStore, units);
    for (const unit of units) unitStore.set(unit.id, unit);
    movementStore.push(...diff.movements);
    return {
      inserted: diff.inserted,
      updated: diff.updated,
      unchanged: diff.unchanged,
      movements: diff.movements,
    };
  }

  async getHistory(): Promise<PriceMovement[]> {
    return [...movementStore].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }

  async appendMovements(movements: PriceMovement[]): Promise<void> {
    movementStore.push(...movements);
  }
}

/** Test helper — wipe the module-level store between test cases. */
export function __resetInMemoryStore(): void {
  unitStore.clear();
  movementStore.length = 0;
}
