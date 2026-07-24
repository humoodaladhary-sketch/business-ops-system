import { Card } from "./ui";
import { STAGE_LABELS, CANONICAL_STAGES, type CanonicalStage } from "@/domain";

export function PipelineBoard({ counts }: { counts: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <Card>
      <div className="space-y-2.5">
        {CANONICAL_STAGES.map((stage: CanonicalStage) => {
          const n = counts[stage] ?? 0;
          const width = (n / max) * 100;
          const isLost = stage === "CLOSED_LOST";
          const isWon = stage === "CLOSED_WON";
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm text-white/60">{STAGE_LABELS[stage]}</span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-white/[0.04]">
                <div
                  className={
                    "h-full rounded-md " +
                    (isLost
                      ? "bg-risk/40"
                      : isWon
                        ? "bg-emerald-500/50"
                        : "bg-gradient-to-r from-gold-deep/70 to-gold/70")
                  }
                  style={{ width: `${Math.max(width, 4)}%` }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs tabular-nums text-white/80">
                  {n}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
