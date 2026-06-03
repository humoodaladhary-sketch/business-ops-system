/**
 * Repository factory. Picks the Supabase adapter when the project's Supabase
 * env vars are present; otherwise falls back to the in-memory adapter so the
 * module still runs (local dev, tests, N8N preview) with zero setup.
 */

import type { InventoryRepository } from "./InventoryRepository";
import { InMemoryInventoryRepository } from "./inMemoryInventoryRepository";
import { SupabaseInventoryRepository } from "./supabaseInventoryRepository";

let cached: InventoryRepository | null = null;

export function getInventoryRepository(): InventoryRepository {
  if (cached) return cached;
  const hasSupabase =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = hasSupabase
    ? new SupabaseInventoryRepository()
    : new InMemoryInventoryRepository();
  return cached;
}

export type { InventoryRepository };
export * from "./InventoryRepository";
