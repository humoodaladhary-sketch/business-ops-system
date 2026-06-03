import { Card, Badge, ProgressBar } from "./ui";
import { formatOMR, formatPct, formatRate } from "../lib/format";
import { TIER_COLORS } from "../_data/config";
import { cn } from "../lib/cn";

export interface LeaderRow {
  id: string;
  name: string;
  role: string;
  volume: number;
  target: number;
  pct: number;
  tier: string;
  splitRate: number;
  projectedPayout: number;
  dealCount: number;
  atRisk: boolean;
  watch: boolean;
  exempt: boolean;
  inRampWindow: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-white/40">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Advisor</th>
            <th className="px-4 py-3 font-medium">Tier</th>
            <th className="px-4 py-3 font-medium">Progress vs target</th>
            <th className="px-4 py-3 text-right font-medium">Volume</th>
            <th className="px-4 py-3 text-right font-medium">Proj. payout</th>
            <th className="px-4 py-3 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              <td className="px-4 py-3 text-white/50">{MEDALS[i] ?? i + 1}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-white">{r.name}</div>
                <div className="text-xs text-white/40">
                  {r.role} · {r.dealCount} {r.dealCount === 1 ? "deal" : "deals"}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={cn("font-medium", TIER_COLORS[r.tier] ?? "text-white")}>{r.tier}</span>
                <span className="ml-1 text-xs text-white/40">{formatRate(r.splitRate)}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <ProgressBar value={r.pct} markers={[0.5, 0.8, 1.0]} className="w-40" />
                  <span className="tabular-nums text-white/70">{formatPct(r.pct)}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-white/80">{formatOMR(r.volume, true)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium text-gold">
                {formatOMR(r.projectedPayout)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {r.atRisk && <Badge variant="risk">At Risk</Badge>}
                  {r.watch && <Badge variant="watch">Watch</Badge>}
                  {r.inRampWindow && <Badge variant="muted">Ramp</Badge>}
                  {r.exempt && <Badge variant="muted">Exempt</Badge>}
                  {!r.atRisk && !r.watch && !r.exempt && !r.inRampWindow && (
                    <Badge variant="good">On track</Badge>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
