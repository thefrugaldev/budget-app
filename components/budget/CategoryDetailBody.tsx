"use client";

import { useMemo, useState } from "react";

import { CategoryEditSheet } from "@/components/budget/CategoryEditSheet";
import { CategorySummaryActions } from "@/components/budget/CategorySummaryActions";
import { EndedBadge } from "@/components/budget/EndedBadge";
import { MonthBarChart, type MonthBarDatum } from "@/components/budget/MonthBarChart";
import { SignedAmount } from "@/components/budget/SignedAmount";
import { ThresholdMeter } from "@/components/budget/ThresholdMeter";
import { TransactionForm } from "@/components/budget/TransactionForm";
import { TransactionList } from "@/components/budget/TransactionList";
import {
  aggregateRange,
  currentMonthKey,
  fmt,
  monthlyTotalsLastN,
  resolveTargetForMonth,
  targetLabel,
  thresholdColor,
  type RangeSelection,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { Category, CategoryTarget, Transaction } from "@/types/budget";

/**
 * Client wrapper around the category detail page's body (everything below
 * the range selector). Owns the optimistic-delete state lifted up from
 * `TransactionList` so the sidebar headline (total, % of cap, threshold
 * meter) and the 6-month trend chart reflect the deletion immediately —
 * without waiting for the action's revalidate to round-trip. If the user
 * clicks Undo within the window, the parent re-includes the row and every
 * aggregate snaps back.
 *
 * `TransactionList` keeps its full timer / inFlight / toast state machine;
 * it only reports the currently-hidden transaction ids up here via
 * `onHiddenIdsChange` (a set, since a bulk delete hides many at once). This
 * avoids duplicating the optimistic-delete mechanism — it's still owned by
 * `TransactionList`, just observed.
 */
export function CategoryDetailBody({
  category,
  categories,
  transactions,
  targets,
  range,
  rangeText,
  now,
}: {
  category: Category;
  categories: Category[];
  transactions: Transaction[];
  targets: CategoryTarget[];
  range: RangeSelection;
  rangeText: string;
  now: Date;
}) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  const visibleTxns = useMemo(() => {
    if (hiddenIds.length === 0) return transactions;
    const hidden = new Set(hiddenIds);
    return transactions.filter((t) => !hidden.has(t.id));
  }, [transactions, hiddenIds]);

  const [agg] = aggregateRange(
    visibleTxns,
    [category],
    range.ymStart,
    range.ymEnd,
    targets,
  );
  const total = agg.total;
  const denominator = agg.denominator;
  const perMonthTarget = resolveTargetForMonth(category.id, range.ymEnd, targets);
  const col = thresholdColor(category.kind, denominator, total);
  const pct = denominator === 0 ? 0 : total / denominator;
  const isInflow = category.kind !== "expense";
  const label = targetLabel(category.kind);
  const isNegative = total < 0;

  const trend: MonthBarDatum[] = useMemo(
    () =>
      monthlyTotalsLastN(visibleTxns, category.id, 6, now).map((m) => ({
        ym: m.ym,
        total: m.total,
        target: resolveTargetForMonth(category.id, m.ym, targets),
      })),
    [visibleTxns, category.id, targets, now],
  );

  const txns = useMemo(
    () =>
      visibleTxns
        .filter((t) => {
          if (t.categoryId !== category.id) return false;
          const ym = t.date.slice(0, 7);
          return ym >= range.ymStart && ym <= range.ymEnd;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [visibleTxns, category.id, range],
  );

  // Live count of this category's transactions across all of time. Drives the
  // Delete / End-category gate inside `CategoryEditSheet` and the summary
  // card overflow — when the user optimistically deletes the last transaction,
  // the Delete affordance flips on immediately without waiting for
  // revalidation.
  const txCountForCategory = useMemo(
    () => visibleTxns.filter((t) => t.categoryId === category.id).length,
    [visibleTxns, category.id],
  );

  // Mirrors the gate inside `CategoryEditSheet`: hard-delete is only legal
  // when this category has at most one target row (its initial), so the
  // summary card's overflow uses the same count to decide whether to expose
  // the Delete affordance.
  const targetRowCountForCategory = useMemo(
    () => targets.filter((t) => t.categoryId === category.id).length,
    [targets, category.id],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl bg-card p-5 ring-1",
            isInflow ? "ring-emerald-200 dark:ring-emerald-900" : "ring-border",
          )}
        >
          {isNegative && (
            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-rose-500" />
          )}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-xl bg-muted text-3xl">
                {category.emoji}
              </div>
              <div className="min-w-0">
                <h1 className="font-heading text-lg font-semibold leading-tight">
                  {category.name}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {label} · {fmt(perMonthTarget)}/mo
                </p>
                {category.activeUntil && (
                  <EndedBadge ym={category.activeUntil} className="mt-1" />
                )}
              </div>
            </div>
            <CategorySummaryActions
              category={category}
              txCount={txCountForCategory}
              targetRowCount={targetRowCountForCategory}
              onEdit={() => setEditOpen(true)}
            />
          </div>
          <p className={cn("font-heading text-3xl font-semibold tabular-nums", col.text)}>
            <SignedAmount kind={category.kind} amount={total} />
          </p>
          <p className="text-xs text-muted-foreground">
            {rangeText.toLowerCase()} · {Math.round(pct * 100)}% of {label.toLowerCase()}
          </p>
          <ThresholdMeter
            kind={category.kind}
            target={denominator}
            amount={total}
            className="mt-2"
            height="h-2"
          />
          <div className="mt-3 -mx-1">
            <MonthBarChart
              data={trend}
              kind={category.kind}
              highlightYm={currentMonthKey(now)}
              width={300}
              height={76}
            />
          </div>
        </div>

        <div
          id="add-transaction"
          className="rounded-2xl bg-card p-4 ring-1 ring-border scroll-mt-20 transition-[box-shadow,--tw-ring-color] duration-300"
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add transaction
          </h2>
          {category.activeUntil ? (
            <p className="text-xs text-muted-foreground">
              This category is ended. Reopen via Edit to add transactions.
            </p>
          ) : (
            <TransactionForm
              categories={categories}
              transactions={visibleTxns}
              initialCategoryId={category.id}
              compact
            />
          )}
        </div>

      </aside>

      <section>
        <TransactionList
          category={category}
          categories={categories}
          transactions={txns}
          allTransactions={visibleTxns}
          rangeText={rangeText}
          now={now}
          onHiddenIdsChange={setHiddenIds}
        />
      </section>

      <CategoryEditSheet
        category={category}
        targets={targets}
        txCount={txCountForCategory}
        now={now}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
