/**
 * GET /api/analytics
 *
 * Returns the full analytics bundle computed by the pure domain engine.
 * Optional ?movementDays=30 controls the recent-movements window.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  comparisonMatrix,
  computeKpis,
  extremesByCategory,
  priceBandByProject,
  pricePerSqmByProject,
  recentMovements,
  unitTypeDistribution,
} from "@/domain/inventory/analytics";
import { getInventoryRepository } from "@/storage/inventory";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const repo = getInventoryRepository();
    const [units, history] = await Promise.all([repo.getAll(), repo.getHistory()]);
    const movementDays = Number(req.nextUrl.searchParams.get("movementDays") ?? "30");

    return NextResponse.json({
      ok: true,
      kpis: computeKpis(units),
      extremesByUnitType: extremesByCategory(units, "unitType"),
      extremesByProject: extremesByCategory(units, "project"),
      pricePerSqmByProject: pricePerSqmByProject(units),
      priceBandByProject: priceBandByProject(units),
      unitTypeDistribution: unitTypeDistribution(units),
      comparisonMatrix: comparisonMatrix(units),
      recentMovements: recentMovements(history, movementDays),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
