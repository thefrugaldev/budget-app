import type { ReactNode } from "react";

import { dayLabel, fmt } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { AccountItemView } from "@/types/net-worth";

import { AccountIcon } from "./AccountIcon";

/**
 * One account's read-only card on the Net Worth page (#109 chunk 6): icon,
 * name, current value, and when it was last recorded (story 14). Purely
 * presentational — the value is computed upstream (holdings × live price, or the
 * manual balance) and passed in. A liability renders as a negative contribution
 * (a real minus sign, not color alone) so it reads as reducing net worth even
 * for a colorblind user. Edit affordances arrive in chunk 7; there are none here.
 */
export function AccountCard({
  account,
  value,
  lastUpdated,
  unpricedCount = 0,
  action,
}: AccountItemView & {
  /** Edit affordance rendered top-right (a client component, role-gated). */
  action?: ReactNode;
}) {
  const isLiability = account.class === "liability";
  const holdingsCount = account.holdings?.length ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <AccountIcon account={account} />
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">{account.name}</p>
            {account.kind === "investment" && (
              <p className="text-xs text-muted-foreground">
                {holdingsCount === 0
                  ? "No holdings"
                  : `${holdingsCount} ${holdingsCount === 1 ? "holding" : "holdings"}`}
              </p>
            )}
            {/* Nudge toward the manual override when part of the value is missing —
                the value above understates the account until these are priced. */}
            {unpricedCount > 0 && (
              <p className="text-xs text-signal-warn-foreground">
                {unpricedCount} {unpricedCount === 1 ? "holding needs" : "holdings need"} a manual
                price
              </p>
            )}
          </div>
        </div>
        {action}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "font-heading text-xl font-semibold tabular-nums",
            isLiability ? "text-signal-bad-foreground" : "text-foreground",
          )}
        >
          {/* Magnitude in, sign applied here: a liability shows as "-$…". */}
          {fmt(isLiability ? -value : value)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {lastUpdated ? `Updated ${dayLabel(lastUpdated)}` : "Not recorded yet"}
        </span>
      </div>
    </div>
  );
}
