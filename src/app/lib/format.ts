export function formatOMR(n: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M OMR`;
    if (abs >= 1000) return `${Math.round(n / 1000)}K OMR`;
    return `${n.toFixed(0)} OMR`;
  }
  return (
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(n) +
    " OMR"
  );
}

export function formatPct(fraction: number, dp = 0): string {
  return `${(fraction * 100).toFixed(dp)}%`;
}

/** Rate fractions render as whole percents (0.35 -> "35%"). */
export function formatRate(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
