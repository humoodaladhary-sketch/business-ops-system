import type { NextTierNudge } from "@/domain";
import { Card, ProgressBar, Badge } from "./ui";
import { formatOMR, formatPct, formatRate } from "../lib/format";
import { TIER_COLORS } from "../_data/config";
import { cn } from "../lib/cn";

export interface TierProgressProps {
  name: string;
  role?: string;
  pct: number; // fraction of target
  tierName: string;
  splitRate: number; // current effective ladder rate
  volume: number;
  target: number;
  projectedPayout: number;
  nudge: NextTierNudge;
}

/**
 * Signature live tier-progress widget. Turns the comp plan into a visible,
 * motivating target with a next-tier nudge.
 */
export function TierProgress(props: TierProgressProps) {
  const { name, role, pct, tierName, splitRate, volume, target, projectedPayout, nudge } = props;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-xl text-white">{name}</h3>
          {role ? <span className="text-xs uppercase tracking-wide text-white/40">{role}</span> : null}
        </div>
        <Badge variant="gold">
          <span className={cn(TIER_COLORS[tierName] ?? "text-gold")}>{tierName}</span>
          <span className="ml-1 text-white/60">· {formatRate(splitRate)} split</span>
        </Badge>
      </div>

      <div className="flex items-end justify-between text-sm">
        <span className="text-3xl font-semibold tabular-nums text-gold">{formatPct(pct)}</span>
        <span className="text-white/50">
          {formatOMR(volume, true)} / {formatOMR(target, true)}
        </span>
      </div>

      <ProgressBar value={pct} markers={[0.5, 0.8, 1.0]} />
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-white/30">
        <span>Recovery</span>
        <span>On&nbsp;Track</span>
        <span>Strong</span>
        <span>Top</span>
      </div>

      <div className="rounded-lg border border-hairline bg-ink-900/50 p-3 text-sm leading-relaxed">
        {nudge.hasNext ? (
          <p className="text-white/80">
            Close <span className="font-semibold text-gold">{formatOMR(nudge.amountToNextTier ?? 0, true)}</span> more to
            move <span className="text-white">{formatRate(nudge.currentSplitRate)}</span> →{" "}
            <span className="font-semibold text-tier-elite">{formatRate(nudge.nextSplitRate ?? 0)}</span> and earn{" "}
            <span className="font-semibold text-gold">~{formatOMR(nudge.extraPayoutEstimate ?? 0)}</span> more this month.
          </p>
        ) : (
          <p className="text-white/70">
            <span className="text-tier-elite">Top tier reached</span> — maximum 50% split locked for the month.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-hairline pt-3 text-sm">
        <span className="text-white/50">Projected payout (provisional)</span>
        <span className="font-semibold tabular-nums text-white">{formatOMR(projectedPayout)}</span>
      </div>
    </Card>
  );
}
