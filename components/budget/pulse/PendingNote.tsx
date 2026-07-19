import { cn } from "@/lib/utils";
import type { PendingRow } from "@/types/attention";

/**
 * The calm, dashed group for savings goals not funded yet this early in the
 * month — one quiet line with a count, never a stack of exception rows (#178
 * story 4). A dashed (not solid) border signals "note, not problem"; the copy
 * names it as normal. Rendered by `NeedsAttention` from the selector's
 * `pending` bucket.
 */
export function PendingNote({
  pending,
  className,
}: {
  pending: PendingRow[];
  className?: string;
}) {
  const n = pending.length;
  return (
    <p
      className={cn(
        "rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground",
        className,
      )}
    >
      {n} {n === 1 ? "goal" : "goals"} not funded yet — normal this early in the month.
    </p>
  );
}
