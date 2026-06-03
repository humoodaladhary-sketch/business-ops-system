import type { FieldSource } from "@/types";

export function SourceBadge({ source }: { source: FieldSource }) {
  const label = source.toUpperCase();
  const cls =
    source === "extracted" ? "badge-extracted"
    : source === "inferred" ? "badge-inferred"
    : source === "assumed"  ? "badge-assumed"
    : "badge-missing";
  return <span className={`badge ${cls}`}>{label}</span>;
}
