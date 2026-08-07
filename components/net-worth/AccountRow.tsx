import type { ReactNode } from "react";

import { dayLabel, fmt } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { AccountItemView } from "@/types/net-worth";

import { AccountIcon } from "./AccountIcon";

/**
 * One account as a dense list row — the list-view counterpart to
 * {@link AccountCard} (#203). Renders the same {@link AccountItemView} data, but
 * as a single line with the value right-aligned into a shared column so
 * magnitudes line up down the group for scanning and statement reconciliation
 * (stories 1, 5). A liability shows a real minus sign, not colour alone, so it
 * reads as reducing net worth for a colourblind user — matching the card.
 *
 * The secondary sub-line compresses the card's two hints into one for density:
 * an unpriced-holdings warning takes precedence over the plain holdings count.
 */
export function AccountRow({
  account,
  value,
  lastUpdated,
  unpricedCount = 0,
  action,
}: AccountItemView & {
  /** Edit affordance rendered at the row end (a client component, role-gated). */
  action?: ReactNode;
}) {
  const isLiability = account.class === "liability";
  const holdingsCount = account.holdings?.length ?? 0;
  const hasUnpriced = unpricedCount > 0;
  const secondary = hasUnpriced
    ? `${unpricedCount} ${unpricedCount === 1 ? "holding needs" : "holdings need"} a manual price`
    : account.kind === "investment"
      ? holdingsCount === 0
        ? "No holdings"
        : `${holdingsCount} ${holdingsCount === 1 ? "holding" : "holdings"}`
      : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <AccountIcon account={account} className="size-9" iconClassName="size-4" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{account.name}</p>
        {secondary && (
          <p
            className={cn(
              "truncate text-xs",
              hasUnpriced ? "text-signal-warn-foreground" : "text-muted-foreground",
            )}
          >
            {secondary}
          </p>
        )}
      </div>
      {/* Metadata between identity and value; dropped on the tightest widths so
          the value column keeps room to align. */}
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {lastUpdated ? `Updated ${dayLabel(lastUpdated)}` : "Not recorded yet"}
      </span>
      <span
        className={cn(
          "shrink-0 min-w-[6rem] text-right font-medium tabular-nums",
          isLiability ? "text-signal-bad-foreground" : "text-foreground",
        )}
      >
        {/* Magnitude in, sign applied here: a liability shows as "-$…". */}
        {fmt(isLiability ? -value : value)}
      </span>
      {action}
    </li>
  );
}
