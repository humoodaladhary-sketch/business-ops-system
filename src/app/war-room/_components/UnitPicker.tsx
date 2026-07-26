"use client";

// Organized live-inventory picker for Pro Mode. Replaces the old flat select
// (whose catalog placeholders all shared an empty reference, so nothing was
// clickable). Filters: community category (ITC / Future Cities / Surooh),
// project, unit type, bedrooms, and max budget — and when the client's
// nationality is non-GCC, GCC-only units are flagged and cannot be picked.
import { useMemo, useState } from "react";
import { Lock, SearchX } from "lucide-react";
import { isGccNationality } from "@/domain/realestate/offer";
import type { LiveOfferUnit } from "../../_data/warRoomUnits";
import { formatOMR } from "../../lib/format";
import { cn } from "../../lib/cn";

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "ITC", label: "ITC communities" },
  { id: "future_cities", label: "Oman Future Cities" },
  { id: "surooh", label: "Surooh" },
] as const;

type CategoryTab = (typeof CATEGORY_TABS)[number]["id"];

const FIELD =
  "w-full rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";

export function UnitPicker({
  units,
  nationality,
  pickedRefs = [],
  onPick,
  title = "Live inventory",
  hint,
}: {
  units: LiveOfferUnit[];
  nationality: string;
  pickedRefs?: string[];
  onPick: (unit: LiveOfferUnit) => void;
  title?: string;
  hint?: string;
}) {
  const [category, setCategory] = useState<CategoryTab>("all");
  const [project, setProject] = useState("");
  const [unitType, setUnitType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [maxBudget, setMaxBudget] = useState("");

  const nonGcc = nationality.trim() !== "" && !isGccNationality(nationality);

  const projects = useMemo(() => {
    const set = new Set(
      units.filter((u) => category === "all" || u.category === category).map((u) => u.project),
    );
    return [...set].sort();
  }, [units, category]);

  const types = useMemo(() => {
    const set = new Set(units.map((u) => u.unitType.split(" · ")[0]).filter(Boolean));
    return [...set].sort();
  }, [units]);

  const filtered = useMemo(() => {
    const cap = Number(maxBudget) || 0;
    const beds = bedrooms === "" ? null : Number(bedrooms);
    return units
      .filter((u) => category === "all" || u.category === category)
      .filter((u) => !project || u.project === project)
      .filter((u) => !unitType || u.unitType.toLowerCase().startsWith(unitType.toLowerCase()))
      .filter((u) => beds == null || (beds === 3 ? (u.bedrooms ?? 0) >= 3 : u.bedrooms === beds))
      .filter((u) => cap === 0 || u.priceOmr <= cap)
      .slice(0, 60);
  }, [units, category, project, unitType, bedrooms, maxBudget]);

  if (units.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-ink-100/50 p-3 text-xs text-white/45">
        Live inventory is unavailable right now — enter the unit manually below.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-ink-900/40 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gold">{title}</span>
        <span className="text-[11px] text-white/40">
          {filtered.length} of {units.length} units{hint ? ` · ${hint}` : ""}
        </span>
      </div>

      {/* Community category */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Community category">
        {CATEGORY_TABS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => {
              setCategory(c.id);
              setProject("");
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition",
              category === c.id
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-hairline text-white/55 hover:text-white",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)} className={FIELD}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select aria-label="Unit type" value={unitType} onChange={(e) => setUnitType(e.target.value)} className={FIELD}>
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select aria-label="Bedrooms" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={FIELD}>
          <option value="">Any bedrooms</option>
          <option value="0">Studio</option>
          <option value="1">1 bed</option>
          <option value="2">2 beds</option>
          <option value="3">3+ beds</option>
        </select>
        <input
          aria-label="Max budget (OMR)"
          type="number"
          min={0}
          step={5000}
          inputMode="numeric"
          placeholder="Max budget (OMR)"
          value={maxBudget}
          onChange={(e) => setMaxBudget(e.target.value)}
          className={FIELD}
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-ink-100/40 px-3 py-4 text-xs text-white/45">
          <SearchX className="h-4 w-4 shrink-0" /> No units match these filters — widen the budget or clear a filter.
        </div>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto pe-1">
          {filtered.map((u) => {
            const blocked = nonGcc && u.ownershipEligibility === "gcc_omani_only";
            const picked = pickedRefs.includes(u.reference);
            return (
              <li key={u.reference}>
                <button
                  type="button"
                  disabled={blocked || picked}
                  onClick={() => onPick(u)}
                  title={blocked ? "GCC / Omani only — not open to this client's nationality" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition",
                    picked
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : blocked
                        ? "cursor-not-allowed border-hairline bg-ink-100/30 text-white/25"
                        : "border-hairline bg-ink-100/50 text-white/80 hover:border-gold/40 hover:bg-ink-100",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {u.reference} — {u.project}
                    </span>
                    <span className="block truncate text-xs text-white/45">
                      {u.unitType || "—"}
                      {u.bedrooms != null ? ` · ${u.bedrooms === 0 ? "Studio" : `${u.bedrooms} bed`}` : ""}
                      {u.areaSqm > 0 ? ` · ${u.areaSqm} m²` : ""}
                      {u.category !== "ITC" ? " · GCC/Omani only" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-sm font-semibold">
                    {formatOMR(u.priceOmr, true)}
                  </span>
                  {blocked && <Lock className="h-3.5 w-3.5 shrink-0" />}
                  {picked && <span className="shrink-0 text-[10px] uppercase">Added</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {nonGcc && (
        <p className="text-[11px] text-white/40">
          Client nationality is non-GCC — GCC/Omani-only units are locked and cannot be offered.
        </p>
      )}
    </div>
  );
}
