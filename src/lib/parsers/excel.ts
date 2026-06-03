/** Excel inventory parser. Tolerant header mapping, Claude handles the rest. */

import * as XLSX from "xlsx";

export interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

export function parseExcelBuffer(buffer: ArrayBuffer | Buffer): ExcelRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  // Take the first sheet; the extraction prompt handles renaming/merging.
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    defval: null,
    raw: true,
  });
  return json;
}
