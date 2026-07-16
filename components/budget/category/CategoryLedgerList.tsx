import { CategoryLedgerRow } from "@/components/budget/category/CategoryLedgerRow";
import {
  aggregateRange,
  isCategoryActiveInRange,
  resolveTargetForMonth,
} from "@/lib/budget";
import {
  compareCategoriesByRecency,
  lastActivityByCategory,
} from "@/lib/category/recency";
import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import type { RangeSelection } from "@/types/range";

/**
 * The Categories ledger (issue #166 chunk 3): a dense, recency-sorted **list**
 * (story 2/3) of the household's budgeting categories, replacing the Pulse card
 * grid as the working surface. Expense + savings only — income lives on its own
 * `/income` page (mirrors how the Pulse grid and the Add-menu category picker
 * scope to expense/savings). Categories are filtered to those active in the
 * selected range (same rule as Pulse), then ordered by most-recent transaction
 * activity so what changed since the last visit floats to the top; categories
 * with no activity sort last.
 *
 * This is a read surface — available to viewers in full (story 28); the edit
 * affordances (the Add menu) are gated separately at the page level.
 */
export function CategoryLedgerList({
  categories,
  transactions,
  targets,
  range,
  now,
}: {
  categories: Category[];
  transactions: Transaction[];
  targets: CategoryTarget[];
  range: RangeSelection;
  now: Date;
}) {
  const inScope = categories.filter(
    (c) =>
      c.kind !== "income" &&
      isCategoryActiveInRange(c, range.ymStart, range.ymEnd),
  );

  const lastActivity = lastActivityByCategory(transactions);
  const ordered = [...inScope].sort(compareCategoriesByRecency(lastActivity));

  const aggregates = aggregateRange(
    transactions,
    inScope,
    range.ymStart,
    range.ymEnd,
    targets,
  );
  const aggregateById = new Map(aggregates.map((a) => [a.categoryId, a]));

  if (ordered.length === 0) {
    return (
      <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-border">
        No categories in this range.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-xl bg-card px-2 ring-1 ring-border">
      {ordered.map((category) => {
        const agg = aggregateById.get(category.id);
        return (
          <CategoryLedgerRow
            key={category.id}
            category={category}
            total={agg?.total ?? 0}
            denominator={agg?.denominator ?? 0}
            perMonthTarget={resolveTargetForMonth(category.id, range.ymEnd, targets)}
            lastActivity={lastActivity.get(category.id)}
            now={now}
          />
        );
      })}
    </ul>
  );
}
