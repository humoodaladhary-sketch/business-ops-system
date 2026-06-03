/**
 * Inventory analytics — pure functions over Unit[]. Zero IO, zero React.
 *
 * This is the engine that must run identically in this app, in N8N, and in
 * the WhatsApp bot. Every function handles nulls, single-item categories,
 * and empty input gracefully (see __tests__/analytics.test.ts).
 */

import type { Unit } from "./unit";
import type { PriceMovement } from "@/storage/inventory/InventoryRepository";

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function nonNull<T>(values: (T | null | undefined)[]): T[] {
  return values.filter((v): v is T => v != null);
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export interface Kpis {
  totalUnits: number;
  totalValueOMR: number;
  avgPricePerSqm: number | null;
  projectCount: number;
  availableCount: number;
}

export function computeKpis(units: Unit[]): Kpis {
  const prices = nonNull(units.map((u) => u.priceOMR));
  const perSqm = nonNull(units.map((u) => u.pricePerSqm));
  const projects = new Set(units.map((u) => u.project));
  return {
    totalUnits: units.length,
    totalValueOMR: prices.reduce((a, b) => a + b, 0),
    avgPricePerSqm: perSqm.length ? Math.round(mean(perSqm)!) : null,
    projectCount: projects.size,
    availableCount: units.filter((u) => u.status === "available").length,
  };
}

// ---------------------------------------------------------------------------
// Extremes by category (lowest vs highest in every category)
// ---------------------------------------------------------------------------

export type CategoryKey = "unitType" | "project";

export interface CategoryExtremes {
  category: string;
  count: number;
  minPriceOMR: number | null;
  maxPriceOMR: number | null;
  minUnitRef: string | null;
  maxUnitRef: string | null;
  spreadPct: number | null;
}

export function extremesByCategory(units: Unit[], key: CategoryKey): CategoryExtremes[] {
  const groups = new Map<string, Unit[]>();
  for (const u of units) {
    const k = u[key];
    const arr = groups.get(k);
    if (arr) arr.push(u);
    else groups.set(k, [u]);
  }

  const out: CategoryExtremes[] = [];
  for (const [category, list] of groups) {
    const priced = list.filter((u): u is Unit & { priceOMR: number } => u.priceOMR != null);
    if (priced.length === 0) {
      out.push({
        category,
        count: list.length,
        minPriceOMR: null,
        maxPriceOMR: null,
        minUnitRef: null,
        maxUnitRef: null,
        spreadPct: null,
      });
      continue;
    }
    let min = priced[0];
    let max = priced[0];
    for (const u of priced) {
      if (u.priceOMR < min.priceOMR) min = u;
      if (u.priceOMR > max.priceOMR) max = u;
    }
    const spreadPct = min.priceOMR > 0 ? ((max.priceOMR - min.priceOMR) / min.priceOMR) * 100 : 0;
    out.push({
      category,
      count: list.length,
      minPriceOMR: min.priceOMR,
      maxPriceOMR: max.priceOMR,
      minUnitRef: min.unitRef,
      maxUnitRef: max.unitRef,
      spreadPct: Math.round(spreadPct * 10) / 10,
    });
  }

  return out.sort((a, b) => a.category.localeCompare(b.category));
}

// ---------------------------------------------------------------------------
// Price-per-sqm and price bands by project
// ---------------------------------------------------------------------------

export interface ProjectPricePerSqm {
  project: string;
  avgPricePerSqm: number | null;
  count: number;
}

export function pricePerSqmByProject(units: Unit[]): ProjectPricePerSqm[] {
  const groups = new Map<string, number[]>();
  for (const u of units) {
    if (u.pricePerSqm == null) continue;
    const arr = groups.get(u.project);
    if (arr) arr.push(u.pricePerSqm);
    else groups.set(u.project, [u.pricePerSqm]);
  }
  const projects = new Set(units.map((u) => u.project));
  const out: ProjectPricePerSqm[] = [];
  for (const project of projects) {
    const vals = groups.get(project) ?? [];
    out.push({
      project,
      avgPricePerSqm: vals.length ? Math.round(mean(vals)!) : null,
      count: vals.length,
    });
  }
  return out.sort((a, b) => a.project.localeCompare(b.project));
}

export interface ProjectPriceBand {
  project: string;
  min: number | null;
  avg: number | null;
  max: number | null;
  count: number;
}

export function priceBandByProject(units: Unit[]): ProjectPriceBand[] {
  const groups = new Map<string, number[]>();
  for (const u of units) {
    if (u.priceOMR == null) continue;
    const arr = groups.get(u.project);
    if (arr) arr.push(u.priceOMR);
    else groups.set(u.project, [u.priceOMR]);
  }
  const projects = new Set(units.map((u) => u.project));
  const out: ProjectPriceBand[] = [];
  for (const project of projects) {
    const vals = groups.get(project) ?? [];
    out.push({
      project,
      min: vals.length ? Math.min(...vals) : null,
      avg: vals.length ? Math.round(mean(vals)!) : null,
      max: vals.length ? Math.max(...vals) : null,
      count: vals.length,
    });
  }
  return out.sort((a, b) => a.project.localeCompare(b.project));
}

// ---------------------------------------------------------------------------
// Unit-type distribution
// ---------------------------------------------------------------------------

export interface UnitTypeShare {
  unitType: string;
  count: number;
  pct: number;
}

export function unitTypeDistribution(units: Unit[]): UnitTypeShare[] {
  if (units.length === 0) return [];
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.unitType, (counts.get(u.unitType) ?? 0) + 1);
  const out: UnitTypeShare[] = [];
  for (const [unitType, count] of counts) {
    out.push({ unitType, count, pct: Math.round((count / units.length) * 1000) / 10 });
  }
  return out.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Comparison matrix (project x metrics)
// ---------------------------------------------------------------------------

export interface ProjectComparison {
  project: string;
  count: number;
  avgPrice: number | null;
  avgPriceSqm: number | null;
  available: number;
}

export function comparisonMatrix(units: Unit[]): ProjectComparison[] {
  const projects = new Set(units.map((u) => u.project));
  const out: ProjectComparison[] = [];
  for (const project of projects) {
    const list = units.filter((u) => u.project === project);
    const prices = nonNull(list.map((u) => u.priceOMR));
    const perSqm = nonNull(list.map((u) => u.pricePerSqm));
    out.push({
      project,
      count: list.length,
      avgPrice: prices.length ? Math.round(mean(prices)!) : null,
      avgPriceSqm: perSqm.length ? Math.round(mean(perSqm)!) : null,
      available: list.filter((u) => u.status === "available").length,
    });
  }
  return out.sort((a, b) => a.project.localeCompare(b.project));
}

// ---------------------------------------------------------------------------
// Recent price movements
// ---------------------------------------------------------------------------

export function recentMovements(history: PriceMovement[], days: number): PriceMovement[] {
  if (days <= 0) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return history
    .filter((m) => {
      const t = Date.parse(m.at);
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
