import { thresholdDescriptor } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { CategoryKind } from "@/types/budget";
import type { ThresholdTone } from "@/types/threshold";

/**
 * Text-bearing "has this category met its target?" chip for the Categories
 * ledger (issue #166 stories 5/6). The word carries the state — expense →
 * cap pressure (Under/Near/At/Over cap), savings/income → progress
 * (Not started / On track / … / Goal met, or Withdrawn) — with tone colour as
 * *reinforcement*, never the sole signal (colourblind-safe). Semantics come
 * from the shared `thresholdDescriptor`, so the chip can't disagree with the
 * meter, Pulse, or the trend.
 *
 * `denominator <= 0` means no target resolved for the range (nothing to meet),
 * so the chip reads a neutral "No target" rather than mis-claiming "Under cap"
 * from a divide-by-zero ratio.
 */
const TONE_TEXT: Record<ThresholdTone, string> = {
  good: "text-signal-good-foreground",
  warn: "text-signal-warn-foreground",
  bad: "text-signal-bad-foreground",
};

export function FulfillmentChip({
  kind,
  total,
  denominator,
  className,
}: {
  kind: CategoryKind;
  /** Signed sum of in-range transaction amounts. */
  total: number;
  /** Sum of resolved targets over active in-range months. */
  denominator: number;
  className?: string;
}) {
  const base =
    "inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-none";

  if (denominator <= 0) {
    return (
      <span className={cn(base, "text-muted-foreground", className)}>
        No target
      </span>
    );
  }

  const descriptor = thresholdDescriptor(kind, denominator, total);
  return (
    <span className={cn(base, TONE_TEXT[descriptor.tone], className)}>
      {descriptor.label}
    </span>
  );
}
