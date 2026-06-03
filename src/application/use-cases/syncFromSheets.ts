import { GoogleSheetsAdapter } from "@/infrastructure/ingestion/GoogleSheetsAdapter";
import { SHEET_SOURCES } from "@/infrastructure/ingestion/sheetRegistry";
import { prisma } from "@/infrastructure/prisma/client";
import { writeDeals, writeLeads } from "@/infrastructure/prisma/writer";

export interface SyncRow {
  agentId: string;
  deals?: number;
  leads?: number;
  rejected?: number;
  error?: string;
}

/** Pull every active agent sheet (deals + leads) and upsert into the database. */
export async function syncFromSheets(): Promise<SyncRow[]> {
  const adapter = new GoogleSheetsAdapter();
  const out: SyncRow[] = [];

  for (const src of SHEET_SOURCES.filter((s) => s.active)) {
    try {
      const d = await adapter.ingestDeals(src.spreadsheetId, src.dealsRange);
      await writeDeals(prisma, src.agentId, d.valid);
      const l = await adapter.ingestLeads(src.spreadsheetId, src.leadsRange);
      await writeLeads(prisma, src.agentId, l.valid);
      out.push({ agentId: src.agentId, deals: d.valid.length, leads: l.valid.length, rejected: d.errors.length + l.errors.length });
    } catch (e) {
      out.push({ agentId: src.agentId, error: (e as Error).message });
    }
  }
  return out;
}
