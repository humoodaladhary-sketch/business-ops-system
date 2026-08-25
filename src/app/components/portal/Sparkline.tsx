// Tiny inline sparkline for the market-pulse band. Server-safe pure SVG —
// no chart library weight on the portal's critical path. Decorative
// (aria-hidden): the numeric value + delta text carry the information.
export function Sparkline({
  values,
  width = 72,
  height = 22,
  stroke = "#D7A52C",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const step = (width - pad * 2) / (values.length - 1);
  const pts = values
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(height - pad - ((v - min) / range) * (height - pad * 2)).toFixed(1)}`)
    .join(" ");
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={pad + (values.length - 1) * step}
        cy={height - pad - ((values[values.length - 1] - min) / range) * (height - pad * 2)}
        r="2"
        fill={stroke}
      />
    </svg>
  );
}
