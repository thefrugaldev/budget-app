"use client";

import { useMemo } from "react";

import { SignedAmount } from "@/components/budget/SignedAmount";
import { Row } from "@/components/budget/transaction/Row";
import { StreakRow } from "@/components/budget/transaction/StreakRow";
import { Checkbox } from "@/components/ui/Checkbox";
import type { TransactionSelection } from "@/hooks/useTransactionSelection";
import { fmtExact } from "@/lib/budget";
import { streakKey, type DayGroup } from "@/lib/transaction";
import {
  areAllSelected,
  areSomeSelected,
  dayGroupIds,
} from "@/lib/transaction-selection";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";

/**
 * One day rendered agenda-style: a sticky day header (bold label + signed
 * subtotal on a hairline rule, plus a select-all-this-day checkbox) with its
 * transactions indented beneath (stories 1, 2, 3, 8, 27). A run of same-vendor
 * transactions arrives as a `CollapsedStreak` and renders as a `StreakRow`;
 * lone transactions render as a plain `Row`. The section is an ARIA region
 * named by day + subtotal for screen-reader navigation (story 22).
 */
export function DaySection({
  group,
  pageCategory,
  pageIsInflow,
  categoryById,
  byId,
  selection,
  activeRowKey,
  onActivate,
  isStreakOpen,
  onToggleStreak,
  onEdit,
  onDelete,
}: {
  group: DayGroup;
  /** Single page category in detail mode; undefined on the global list. */
  pageCategory: Category | undefined;
  pageIsInflow: boolean;
  categoryById: Map<string, Category>;
  byId: Map<string, Transaction>;
  selection: TransactionSelection;
  activeRowKey: string | null;
  onActivate: (key: string) => void;
  isStreakOpen: (key: string) => boolean;
  onToggleStreak: (key: string) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  // A global day's subtotal nets across kinds, so it renders as a plain signed
  // sum (expense convention: no leading "+", no green); a detail day inherits
  // the page kind and may show green when the inflow total is positive.
  const subtotalKind = pageCategory?.kind ?? "expense";
  const subtotalPositive = pageIsInflow && group.subtotal > 0;
  const dayIds = useMemo(() => dayGroupIds(group), [group]);
  return (
    <section aria-label={`${group.label}, ${fmtExact(group.subtotal)}`}>
      <h3 className="sticky top-14 z-10 flex items-baseline gap-2 border-b border-border bg-background px-1 pb-2.5 pt-4 text-sm font-semibold">
        {selection.selectionMode && (
          <Checkbox
            label={`Select all on ${group.label}`}
            checked={areAllSelected(selection.selected, dayIds)}
            indeterminate={areSomeSelected(selection.selected, dayIds)}
            onCheckedChange={(on) => selection.setMany(dayIds, on)}
            className="self-center"
          />
        )}
        <span className="text-foreground">{group.label}</span>
        <span
          className={cn(
            "ml-auto tabular-nums text-foreground",
            subtotalPositive && "text-emerald-700 dark:text-emerald-400",
          )}
        >
          <SignedAmount kind={subtotalKind} amount={group.subtotal} />
        </span>
      </h3>
      <ul>
        {group.rows.map((row) =>
          row.kind === "single" ? (
            <Row
              key={row.transaction.id}
              rowKey={row.transaction.id}
              transaction={row.transaction}
              pageCategory={pageCategory}
              categoryById={categoryById}
              selection={selection}
              active={activeRowKey === row.transaction.id}
              onActivate={onActivate}
              onEdit={() => onEdit(row.transaction)}
              onDelete={() => onDelete(row.transaction)}
            />
          ) : (
            <StreakRow
              key={streakKey(group.date, row.vendor)}
              streakRowKey={streakKey(group.date, row.vendor)}
              streak={row}
              pageCategory={pageCategory}
              pageIsInflow={pageIsInflow}
              categoryById={categoryById}
              byId={byId}
              selection={selection}
              activeRowKey={activeRowKey}
              onActivate={onActivate}
              open={isStreakOpen(streakKey(group.date, row.vendor))}
              onToggleOpen={onToggleStreak}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ),
        )}
      </ul>
    </section>
  );
}
