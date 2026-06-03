/**
 * GET /api/inventory
 *
 * Returns all stored units. Optional query params for lightweight filtering
 * so N8N / WhatsApp can pull slices:
 *   ?project=  ?unitType=  ?status=  ?itc=1  ?maxPrice=  ?minPrice=
 */

import { NextRequest, NextResponse } from "next/server";
import { getInventoryRepository } from "@/storage/inventory";
import type { Unit } from "@/domain/inventory/unit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const repo = getInventoryRepository();
    let units = await repo.getAll();
    const sp = req.nextUrl.searchParams;

    const project = sp.get("project");
    const unitType = sp.get("unitType");
    const status = sp.get("status");
    const itc = sp.get("itc");
    const minPrice = sp.get("minPrice");
    const maxPrice = sp.get("maxPrice");

    units = units.filter((u: Unit) => {
      if (project && u.project !== project) return false;
      if (unitType && u.unitType !== unitType) return false;
      if (status && u.status !== status) return false;
      if (itc === "1" && !u.itcEligible) return false;
      if (minPrice && (u.priceOMR == null || u.priceOMR < Number(minPrice))) return false;
      if (maxPrice && (u.priceOMR == null || u.priceOMR > Number(maxPrice))) return false;
      return true;
    });

    return NextResponse.json({ ok: true, count: units.length, units });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
