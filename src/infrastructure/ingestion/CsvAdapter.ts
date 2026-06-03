import { parse } from "csv-parse/sync";
import { DEAL_HEADER_ALIASES, normalizeHeader } from "./parsers";
import { validateDealRecord, type DealInput } from "./zod-schemas";

export interface IngestRowError {
  rowIndex: number;
  raw: Record<string, string>;
  errors: string[];
}

export interface IngestResult {
  valid: DealInput[];
  errors: IngestRowError[];
  rawRows: Record<string, string>[]; // everything, for append-only staging
  headerRowIndex: number;
}

// The deals tab carries decorative rows above the header; find the real header
// by looking for the row that contains the key deal columns.
function findHeaderRow(matrix: string[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const norm = matrix[i].map(normalizeHeader);
    const hasName = norm.some((h) => h === "client name");
    const hasDev = norm.some((h) => h === "develoepr name" || h === "developer name");
    if (hasName && hasDev) return i;
  }
  return 0;
}

/** Parse a "My Deals Status" CSV export into validated deal rows + logged errors. */
export function parseDealsCsv(csv: string): IngestResult {
  const matrix: string[][] = parse(csv, { relaxColumnCount: true, skipEmptyLines: false });
  if (matrix.length === 0) {
    return { valid: [], errors: [], rawRows: [], headerRowIndex: 0 };
  }

  const headerRowIndex = findHeaderRow(matrix);
  const headers = matrix[headerRowIndex].map(normalizeHeader);

  const valid: DealInput[] = [];
  const errors: IngestRowError[] = [];
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

    // Skip wholly empty rows and footer aggregate rows (no client name).
    const hasClient = String(canonical.clientName ?? "").trim() !== "";
    const isAggregate = Object.values(raw).some((v) => /total|balance|paid/i.test(v)) && !hasClient;
    if (!hasClient || isAggregate) continue;

    rawRows.push(raw);
    const result = validateDealRecord(canonical);
    if (result.ok) valid.push(result.value);
    else errors.push({ rowIndex: r, raw, errors: result.errors });
  }

  return { valid, errors, rawRows, headerRowIndex };
}
