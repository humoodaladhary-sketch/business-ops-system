// Comparable-property import: tolerant CSV / JSON parsing for user-supplied
// comp data when no live provider exists. Pure and deterministic. Imported
// rows are marked provenance "observed" only when the text says so — the
// default is "estimated" with the stated source, and rows missing the
// essentials (reference/project/area) are rejected with a reason rather than
// silently guessed.
import type { ComparableProperty } from "./comparables";

export interface ImportOutcome {
  comps: ComparableProperty[];
  /** Per-row rejection reasons, e.g. "row 3: missing areaSqm". */
  errors: string[];
}

/** Header aliases → canonical field. Case/space/underscore-insensitive. */
const HEADER_MAP: Record<string, keyof ComparableProperty> = {
  reference: "reference",
  ref: "reference",
  unitref: "reference",
  project: "project",
  community: "project",
  unittype: "unitType",
  type: "unitType",
  bedrooms: "bedrooms",
  beds: "bedrooms",
  areasqm: "areaSqm",
  area: "areaSqm",
  sqm: "areaSqm",
  askingprice: "askingPriceOmr",
  askingpriceomr: "askingPriceOmr",
  price: "askingPriceOmr",
  transactionprice: "transactionPriceOmr",
  transactionpriceomr: "transactionPriceOmr",
  soldprice: "transactionPriceOmr",
  monthlyrent: "monthlyRentOmr",
  monthlyrentomr: "monthlyRentOmr",
  annualrent: "annualRentOmr",
  annualrentomr: "annualRentOmr",
  dailyrate: "dailyRateOmr",
  dailyrateomr: "dailyRateOmr",
  adr: "dailyRateOmr",
  occupancy: "occupancyPct",
  occupancypct: "occupancyPct",
  distancekm: "distanceKm",
  distance: "distanceKm",
  listingdate: "listingDate",
  date: "listingDate",
  datasource: "dataSource",
  source: "dataSource",
  verifiedat: "verifiedAt",
  verified: "verifiedAt",
  provenance: "provenance",
};

const NUMERIC_FIELDS = new Set<keyof ComparableProperty>([
  "bedrooms",
  "areaSqm",
  "askingPriceOmr",
  "transactionPriceOmr",
  "monthlyRentOmr",
  "annualRentOmr",
  "dailyRateOmr",
  "occupancyPct",
  "distanceKm",
]);

function canonHeader(h: string): keyof ComparableProperty | null {
  return HEADER_MAP[h.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "").replace(/omr$/i, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Split one CSV line honouring double quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function finalizeRow(
  raw: Partial<Record<keyof ComparableProperty, unknown>>,
  rowNo: number,
  fallbackSource: string,
): { comp?: ComparableProperty; error?: string } {
  const reference = typeof raw.reference === "string" ? raw.reference.trim() : "";
  const project = typeof raw.project === "string" ? raw.project.trim() : "";
  const areaSqm = typeof raw.areaSqm === "number" ? raw.areaSqm : 0;
  if (!reference) return { error: `row ${rowNo}: missing reference` };
  if (!project) return { error: `row ${rowNo}: missing project` };
  if (!(areaSqm > 0)) return { error: `row ${rowNo}: missing areaSqm` };

  const provenanceRaw = typeof raw.provenance === "string" ? raw.provenance.toLowerCase().trim() : "";
  const provenance: ComparableProperty["provenance"] =
    provenanceRaw === "observed" ? "observed" : provenanceRaw === "assumed" ? "assumed" : "estimated";

  return {
    comp: {
      reference,
      project,
      unitType: typeof raw.unitType === "string" && raw.unitType ? raw.unitType : undefined,
      bedrooms: typeof raw.bedrooms === "number" ? raw.bedrooms : null,
      areaSqm,
      askingPriceOmr: typeof raw.askingPriceOmr === "number" ? raw.askingPriceOmr : null,
      transactionPriceOmr: typeof raw.transactionPriceOmr === "number" ? raw.transactionPriceOmr : null,
      monthlyRentOmr: typeof raw.monthlyRentOmr === "number" ? raw.monthlyRentOmr : null,
      annualRentOmr: typeof raw.annualRentOmr === "number" ? raw.annualRentOmr : null,
      dailyRateOmr: typeof raw.dailyRateOmr === "number" ? raw.dailyRateOmr : null,
      occupancyPct: typeof raw.occupancyPct === "number" ? raw.occupancyPct : null,
      distanceKm: typeof raw.distanceKm === "number" ? raw.distanceKm : null,
      listingDate: typeof raw.listingDate === "string" && raw.listingDate ? raw.listingDate : undefined,
      dataSource:
        typeof raw.dataSource === "string" && raw.dataSource.trim() ? raw.dataSource.trim() : fallbackSource,
      verifiedAt: typeof raw.verifiedAt === "string" && raw.verifiedAt ? raw.verifiedAt : undefined,
      provenance,
    },
  };
}

/**
 * Parses pasted comparables as JSON (array of objects) or CSV with a header
 * row. `fallbackSource` labels rows that do not state their own source —
 * imports without any source are still traceable to "who pasted what, when".
 */
export function parseComparables(text: string, fallbackSource: string): ImportOutcome {
  const trimmed = text.trim();
  if (!trimmed) return { comps: [], errors: ["nothing to import"] };

  // --- JSON path
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const comps: ComparableProperty[] = [];
      const errors: string[] = [];
      arr.forEach((item, i) => {
        if (typeof item !== "object" || item == null) {
          errors.push(`row ${i + 1}: not an object`);
          return;
        }
        const raw: Partial<Record<keyof ComparableProperty, unknown>> = {};
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          const key = canonHeader(k);
          if (!key) continue;
          if (NUMERIC_FIELDS.has(key)) {
            raw[key] = typeof v === "number" ? v : typeof v === "string" ? (toNumber(v) ?? undefined) : undefined;
          } else {
            raw[key] = typeof v === "string" ? v : v == null ? undefined : String(v);
          }
        }
        const { comp, error } = finalizeRow(raw, i + 1, fallbackSource);
        if (comp) comps.push(comp);
        if (error) errors.push(error);
      });
      return { comps, errors };
    } catch {
      return { comps: [], errors: ["invalid JSON"] };
    }
  }

  // --- CSV path
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { comps: [], errors: ["CSV needs a header row and at least one data row"] };
  const headers = splitCsvLine(lines[0]).map(canonHeader);
  if (!headers.some((h) => h === "reference")) {
    return { comps: [], errors: ["CSV header must include a reference column"] };
  }
  const comps: ComparableProperty[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw: Partial<Record<keyof ComparableProperty, unknown>> = {};
    headers.forEach((key, col) => {
      if (!key || cells[col] == null || cells[col] === "") return;
      raw[key] = NUMERIC_FIELDS.has(key) ? (toNumber(cells[col]) ?? undefined) : cells[col];
    });
    const { comp, error } = finalizeRow(raw, i, fallbackSource); // data row N = line N (header is line 0)
    if (comp) comps.push(comp);
    if (error) errors.push(error);
  }
  return { comps, errors };
}
