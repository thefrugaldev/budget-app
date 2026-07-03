import { monthLabel } from "@/lib/budget";
import { cn } from "@/lib/utils";

/**
 * Rose pill marker shown wherever a category surfaces its `activeUntil`
 * state — Pulse card, detail page summary, and anywhere a category list
 * row exposes the ended state. Centralised so the look stays consistent
 * everywhere a category can read as "ended".
 */
export function EndedBadge({
  ym,
  className,
}: {
  /** `YYYY-MM` of the last active month (i.e. `category.activeUntil`). */
  ym: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-signal-bad/15 px-2 py-0.5 text-[11px] font-medium text-signal-bad-foreground",
        className,
      )}
      title={`Ended after ${ym}`}
    >
      Ended {monthLabel(ym)}
    </span>
  );
}
