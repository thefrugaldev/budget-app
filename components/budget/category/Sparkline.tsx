import { cn } from "@/lib/utils";

/**
 * Tiny trend line drawn from a pre-computed series of monthly totals (typically
 * the trailing six months via `monthlyTotalsLastN`). Pure geometry — it takes
 * the numbers, not raw transactions, so the caller decides the window and the
 * component ships no data dependency. Decorative (`aria-hidden`); the figures it
 * illustrates are always carried as real text alongside it.
 */
export function Sparkline({
  totals,
  className,
}: {
  totals: number[];
  className?: string;
}) {
  const max = Math.max(...totals, 1);
  const W = 70;
  const H = 22;
  const step = totals.length > 1 ? W / (totals.length - 1) : 0;
  const points = totals
    .map((total, i) => `${i * step},${H - (total / max) * H}`)
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={cn("text-muted-foreground/60", className)}
      />
    </svg>
  );
}
