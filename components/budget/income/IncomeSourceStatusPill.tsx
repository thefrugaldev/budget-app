import { cn } from "@/lib/utils";
import type { IncomeSourceStatus } from "@/types/budget";

/**
 * Exception-only pill rendered alongside the income source's display label
 * on `/income`. Only renders for "scheduled-change" and "ended" — the
 * "active" state is the default and reads as no pill, so the visual
 * vocabulary stays quiet on the common case.
 */
export function IncomeSourceStatusPill({
  status,
  copy,
}: {
  status: Exclude<IncomeSourceStatus, "active">;
  copy: string;
}) {
  const palette = {
    "scheduled-change":
      "bg-signal-good/15 text-signal-good-foreground",
    ended: "bg-signal-bad/15 text-signal-bad-foreground",
  } satisfies Record<Exclude<IncomeSourceStatus, "active">, string>;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
        palette[status],
      )}
    >
      {copy}
    </span>
  );
}
