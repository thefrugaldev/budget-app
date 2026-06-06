import type { Category } from "@/types/budget";
import { thresholdColor, thresholdFor } from "@/lib/budget";
import { cn } from "@/lib/utils";

export function ThresholdMeter({
  category,
  amount,
  className,
  height = "h-1.5",
}: {
  category: Category;
  amount: number;
  className?: string;
  height?: string;
}) {
  const state = thresholdFor(category, amount);
  const col = thresholdColor(category.kind, state);
  const pct = category.monthly === 0 ? 0 : amount / category.monthly;
  return (
    <div className={cn("overflow-hidden rounded-full bg-muted", height, className)}>
      <div className={cn("h-full", col.bar)} style={{ width: `${Math.min(100, pct * 100)}%` }} />
    </div>
  );
}
