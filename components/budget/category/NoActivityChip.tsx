import { CircleDashed } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CategoryZeroState } from "@/types/category";

/**
 * Shown in place of the {@link FulfillmentChip} when a category has **no logged
 * activity** in a single-month view (issue: "spot zero-transaction categories").
 * Replaces the fulfillment chip on purpose: at $0 an expense's fulfillment chip
 * reads a reassuring green "Under cap", which for an unpaid recurring bill is
 * actively misleading — this chip tells the truth instead.
 *
 * Two states, from `categoryZeroState`: the warn-toned "None yet" (an
 * *expected* category silent in the in-progress month — a possibly-missed bill,
 * given the leading `CircleDashed` "awaiting" glyph) and the muted "Nothing
 * logged" (any other zero — for a spend-limit category, quietly the good
 * outcome). The word carries the state; tone/glyph only reinforce it, so it
 * stays legible to colourblind and assistive-tech users.
 */
export function NoActivityChip({
  state,
  className,
}: {
  state: CategoryZeroState;
  className?: string;
}) {
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-none";
  return (
    <span
      className={cn(
        base,
        state.tone === "warn" ? "text-signal-warn-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {state.tone === "warn" && <CircleDashed aria-hidden className="size-3" />}
      {state.label}
    </span>
  );
}
