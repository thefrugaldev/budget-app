"use client";

import { useMemo, useState } from "react";

import { CategoryEditSheet } from "@/components/budget/category/CategoryEditSheet";
import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { CategorySummaryActions } from "@/components/budget/category/CategorySummaryActions";
import { EndedBadge } from "@/components/budget/category/EndedBadge";
import { MonthBarChart } from "@/components/budget/charts/MonthBarChart";
import { SignedAmount } from "@/components/budget/charts/SignedAmount";
import { ThresholdMeter } from "@/components/budget/charts/ThresholdMeter";
import { SuggestionActions } from "@/components/budget/suggestion/SuggestionActions";
import { SuggestionEvidence } from "@/components/budget/suggestion/SuggestionEvidence";
import { TransactionForm } from "@/components/budget/transaction/TransactionForm";
import { TransactionList } from "@/components/budget/transaction/TransactionList";
import { useCanEdit } from "@/hooks/useCanEdit";
import {
  aggregateRange,
  currentMonthKey,
  fmt,
  monthShortYear,
  monthlyTotalsLastN,
  nextScheduledTarget,
  resolveTargetForMonth,
  targetLabel,
  thresholdColor,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type {
  Category,
  CategoryTarget,
  MonthBarDatum,
  Transaction,
} from "@/types/budget";
import type { RangeSelection } from "@/types/range";
import type { TargetSuggestionView } from "@/types/target-suggestion";

/** Trailing months shown in the detail trend chart — a full year of context so a
 * slow multi-year drift is visible (story 15), wider than the detector's own
 * fixed 6-month judging window. */
const TREND_MONTHS = 12;

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
  suggestionView,
}: {
  category: Category;
  categories: Category[];
  transactions: Transaction[];
  targets: CategoryTarget[];
  range: RangeSelection;
  rangeText: string;
  now: Date;
  /** A live Target suggestion for this category (#186 chunk 6), or null. */
  suggestionView?: TargetSuggestionView | null;
}) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = useCanEdit();

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
      monthlyTotalsLastN(visibleTxns, category.id, TREND_MONTHS, now).map((m) => ({
        ym: m.ym,
        total: m.total,
        target: resolveTargetForMonth(category.id, m.ym, targets),
      })),
    [visibleTxns, category.id, targets, now],
  );

  // A future-dated target row (an accepted suggestion or a manual "apply next
  // month" edit) doesn't change the current view until the month arrives — so
  // surface the nearest scheduled change inline by the current cap, direction
  // carried as a word+arrow (never colour alone).
  const thisMonth = currentMonthKey(now);
  const scheduled = nextScheduledTarget(category.id, thisMonth, targets);
  // Direction is read against the cap shown right beside it in the header, so
  // the arrow and the two figures never disagree on screen.
  const scheduledDown = scheduled ? scheduled.monthly < perMonthTarget : false;

  // The suggestion (proposed-cap line + caption actions) is a pure edit
  // affordance — absent for viewers (useCanEdit), server still gates the
  // actions. The scheduled-cap chip above is informational and stays for all.
  const liveSuggestion = canEdit ? suggestionView ?? null : null;

  // Cap references drawn over the bars: the current cap as one continuous
  // dashed line (so it reads across every month, including any that predate it,
  // rather than vanishing) and — when a suggestion is live — the proposed cap
  // as an emphasised line, so the headroom the change buys reads at a glance
  // (story 14). The caption below carries the same numbers as real text.
  const referenceLines = [
    ...(perMonthTarget > 0
      ? [{ value: perMonthTarget, label: fmt(perMonthTarget), dashed: true }]
      : []),
    ...(liveSuggestion
      ? [
          {
            value: liveSuggestion.suggestion.proposedTarget,
            label: `→ ${fmt(liveSuggestion.suggestion.proposedTarget)}`,
            emphasis: true,
          },
        ]
      : []),
  ];

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
            isInflow ? "ring-signal-good/30" : "ring-border",
          )}
        >
          {isNegative && (
            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal-bad" />
          )}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <CategoryIcon category={category} className="size-12" iconClassName="size-6" />
              <div className="min-w-0">
                <h1 className="font-heading text-lg font-semibold leading-tight">
                  {category.name}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {label} · {fmt(perMonthTarget)}/mo
                </p>
                {scheduled && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span aria-hidden>{scheduledDown ? "↓ " : "↑ "}</span>
                    <span className="sr-only">
                      {scheduledDown ? "Decreasing to " : "Increasing to "}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {fmt(scheduled.monthly)}
                    </span>
                    /mo from {monthShortYear(scheduled.effectiveFrom)}
                  </p>
                )}
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
          <p className={cn("font-heading text-hero font-semibold tabular-nums", col.text)}>
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
              highlightYm={thisMonth}
              referenceLines={referenceLines.length > 0 ? referenceLines : undefined}
              width={300}
              height={96}
            />
          </div>

          {/* The chart is the suggestion's surface (#186 chunk 6): directly
              beneath it, the caption carries the pitch (real text — the
              load-bearing, accessible readout) and the Accept / Not now /
              Adjust… actions. Editor-only, like the Pulse module. */}
          {liveSuggestion && (
            <div className="mt-3 border-t border-border pt-3">
              <SuggestionEvidence
                suggestion={liveSuggestion.suggestion}
                category={category}
              />
              <div className="mt-3">
                <SuggestionActions view={liveSuggestion} now={now} />
              </div>
            </div>
          )}
        </div>

        {/* Adding transactions is an editor action — the whole card is absent
            for viewers (#111 story 9), not a disabled shell. */}
        {canEdit && (
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
        )}
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

      {/* Unreachable for viewers (the edit pencil is hidden), but gated too so
          the sheet and its inline target editors never mount for them. */}
      {canEdit && (
        <CategoryEditSheet
          category={category}
          targets={targets}
          txCount={txCountForCategory}
          now={now}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}
