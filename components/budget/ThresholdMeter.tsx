import type { CategoryKind } from "@/types/budget";
import { thresholdColor } from "@/lib/budget";
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
  const pct = target === 0 ? 0 : amount / target;
  const barWidth = Math.max(0, Math.min(100, pct * 100));
  return (
    <div className={cn("overflow-hidden rounded-full bg-muted", height, className)}>
      <div className={cn("h-full", col.bar)} style={{ width: `${barWidth}%` }} />
    </div>
  );
}
