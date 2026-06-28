import type { CategoryKind } from "@/types/budget";
import { thresholdColor, thresholdDescriptor } from "@/lib/budget";
import { cn } from "@/lib/utils";

export function ThresholdMeter({
  kind,
  target,
  amount,
  className,
  height = "h-1.5",
}: {
  kind: CategoryKind;
  target: number;
  amount: number;
  className?: string;
  height?: string;
}) {
  const col = thresholdColor(kind, target, amount);
  const descriptor = thresholdDescriptor(kind, target, amount);
  const pct = target === 0 ? 0 : amount / target;
  const percent = Math.round(pct * 100);
  const barWidth = Math.max(0, Math.min(100, pct * 100));
  // Exposed as a progressbar so screen-reader users hear the progress and the
  // threshold state ("62% — Under cap"), not just an unlabeled bar. aria-valuenow
  // is clamped to the 0–100 track; aria-valuetext carries the true percentage
  // (which can exceed 100 when over) plus the non-color state word.
  return (
    <div
      role="progressbar"
      aria-label={kind === "expense" ? "Cap usage" : "Goal progress"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(barWidth)}
      aria-valuetext={`${percent}% — ${descriptor.label}`}
      className={cn("overflow-hidden rounded-full bg-muted", height, className)}
    >
      <div className={cn("h-full", col.bar)} style={{ width: `${barWidth}%` }} />
    </div>
  );
}
