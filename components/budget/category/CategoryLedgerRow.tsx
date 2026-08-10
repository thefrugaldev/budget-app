import Link from "next/link";

import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { CategoryPeekTrigger } from "@/components/budget/category/CategoryPeekTrigger";
import { EndedBadge } from "@/components/budget/category/EndedBadge";
import { FulfillmentChip } from "@/components/budget/category/FulfillmentChip";
import { NoActivityChip } from "@/components/budget/category/NoActivityChip";
import { SignedAmount } from "@/components/budget/charts/SignedAmount";
import { fmt, targetLabel, thresholdColor } from "@/lib/budget";
import { relativeDayLabel } from "@/lib/category/recency";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";
import type { CategoryZeroState } from "@/types/category";

/**
 * One dense row of the Categories ledger (issue #166 chunk 3). The row links to
 * the full category detail page (story 10); the peek trigger is a **sibling** to
 * that link (story 9), never nested inside it, so both are unambiguous, keyboard
 * reachable, and valid (no interactive-in-interactive). Shows icon + name +
 * cap/goal sub-label, the signed in-range total, the fulfillment chip (story 5),
 * and a relative last-activity stamp (story 4).
 */
export function CategoryLedgerRow({
  category,
  total,
  denominator,
  perMonthTarget,
  lastActivity,
  recentTransactions,
  zeroState,
  now,
}: {
  category: Category;
  /** Signed sum of in-range transaction amounts. */
  total: number;
  /** Sum of resolved targets over active in-range months (chip denominator). */
  denominator: number;
  /** Resolved monthly target for the latest month in range (sub-label). */
  perMonthTarget: number;
  /** Most-recent transaction date ("YYYY-MM-DD"), or undefined if none. */
  lastActivity: string | undefined;
  /** The category's most-recent transactions (newest first) for the peek. */
  recentTransactions: Transaction[];
  /**
   * The "nothing logged" chip state when the category is silent in a
   * single-month view, else `null` — in which case the fulfillment chip shows.
   */
  zeroState: CategoryZeroState | null;
  now: Date;
}) {
  // At $0 the fulfillment chip's tone would misread (a green "Under cap"), so
  // when the row is showing the no-activity chip the amount drops to a neutral
  // tone rather than inheriting the threshold colour.
  const col = thresholdColor(category.kind, denominator, total);

  return (
    <li className="flex items-center gap-2 border-b border-border last:border-b-0">
      <Link
        href={`/categories/${category.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-3 pl-1 pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CategoryIcon category={category} className="size-9" iconClassName="size-4" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{category.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {targetLabel(category.kind)} · {fmt(perMonthTarget)}/mo
            </span>
            {category.activeUntil && <EndedBadge ym={category.activeUntil} />}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span
            className={cn(
              "font-medium tabular-nums",
              zeroState ? "text-muted-foreground" : col.text,
            )}
          >
            <SignedAmount kind={category.kind} amount={total} />
          </span>
          <span className="flex items-center gap-2">
            {zeroState ? (
              <NoActivityChip state={zeroState} />
            ) : (
              <FulfillmentChip
                kind={category.kind}
                total={total}
                denominator={denominator}
              />
            )}
            <span className="text-xs text-muted-foreground">
              {relativeDayLabel(lastActivity, now)}
            </span>
          </span>
        </div>
      </Link>
      <CategoryPeekTrigger
        category={category}
        transactions={recentTransactions}
        now={now}
      />
    </li>
  );
}
