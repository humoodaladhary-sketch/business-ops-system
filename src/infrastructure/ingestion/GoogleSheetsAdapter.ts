import { google } from "googleapis";
import { DEAL_HEADER_ALIASES, normalizeHeader } from "./parsers";
import { validateDealRecord, type DealInput } from "./zod-schemas";
import type { IngestResult } from "./CsvAdapter";

/**
 * Google Sheets ingestion (Phase 2). Reads a values range, then reuses the same
 * row-mapping/validation as the CSV path. Auth via a base64 service-account JSON
 * in GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (read-only scope).
 */
export class GoogleSheetsAdapter {
  private auth() {
    const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    if (!b64) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not set — use CSV upload or configure a service account.",
      );
    }
    const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
  }

  /** Read a tab as a string matrix (e.g. range "My Deals Status!A1:U200"). */
  async readMatrix(spreadsheetId: string, range: string): Promise<string[][]> {
    const sheets = google.sheets({ version: "v4", auth: await this.auth() });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return (res.data.values ?? []).map((row) => row.map((c) => (c ?? "").toString()));
  }

  /** Read + validate a "My Deals Status" tab into deal rows + logged errors. */
  async ingestDeals(spreadsheetId: string, range: string): Promise<IngestResult> {
    const matrix = await this.readMatrix(spreadsheetId, range);
    return matrixToDeals(matrix);
  }
}

export function matrixToDeals(matrix: string[][]): IngestResult {
  if (matrix.length === 0) return { valid: [], errors: [], rawRows: [], headerRowIndex: 0 };

  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const norm = matrix[i].map(normalizeHeader);
    if (norm.includes("client name") && (norm.includes("develoepr name") || norm.includes("developer name"))) {
      headerRowIndex = i;
      break;
    }
  }
  const headers = matrix[headerRowIndex].map(normalizeHeader);

  const valid: DealInput[] = [];
  const errors: IngestResult["errors"] = [];
  const rawRows: Record<string, string>[] = [];

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const raw: Record<string, string> = {};
    const canonical: Record<string, unknown> = {};
    headers.forEach((h, c) => {
      const value = (cells[c] ?? "").toString();
      raw[h || `col${c}`] = value;
      const key = DEAL_HEADER_ALIASES[h];
      if (key) canonical[key] = value;
    });
    if (String(canonical.clientName ?? "").trim() === "") continue;
    rawRows.push(raw);
    const result = validateDealRecord(canonical);
    if (result.ok) valid.push(result.value);
    else errors.push({ rowIndex: r, raw, errors: result.errors });
  }

  return { valid, errors, rawRows, headerRowIndex };
}
