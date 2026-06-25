"use client";

import { ChevronRight } from "lucide-react";
import { useId } from "react";

import { SignedAmount } from "@/components/budget/charts/SignedAmount";
import { CheckboxCell } from "@/components/budget/transaction/CheckboxCell";
import { Row } from "@/components/budget/transaction/Row";
import type { TransactionSelection } from "@/hooks/useTransactionSelection";
import { fmtExact } from "@/lib/budget";
import type { CollapsedStreak } from "@/lib/transaction";
import { areAllSelected, areSomeSelected } from "@/lib/transaction-selection";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";

/**
 * A day's run of ≥ 2 transactions at one vendor as a single disclosure row:
 * `Whole Foods · 4× $87.42` (uniform) or `Whole Foods · 3 transactions`
 * (mixed), with the run's netted signed total on the right. Its checkbox
 * selects/deselects every underlying id at once (story, "selecting a collapsed
 * streak selects all underlying ids"); Space on the focused header does the
 * same, Enter expands. Expanding reveals each underlying `Row` with its own
 * checkbox and overflow menu (story 5).
 */
export function StreakRow({
  streakRowKey,
  streak,
  pageCategory,
  pageIsInflow,
  categoryById,
  byId,
  selection,
  activeRowKey,
  onActivate,
  open,
  onToggleOpen,
  onEdit,
  onDelete,
}: {
  streakRowKey: string;
  streak: CollapsedStreak;
  pageCategory: Category | undefined;
  pageIsInflow: boolean;
  categoryById: Map<string, Category>;
  byId: Map<string, Transaction>;
  selection: TransactionSelection;
  activeRowKey: string | null;
  onActivate: (key: string) => void;
  open: boolean;
  onToggleOpen: (key: string) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const panelId = useId();
  // A streak collapses by vendor alone, so on the global list it can span
  // categories — the header is a vendor aggregate with no single pill, and its
  // total nets across kinds (expense convention). Each underlying row still
  // carries its own category pill once expanded.
  const streakKind = pageCategory?.kind ?? "expense";
  const total = streak.subtotal;
  const breakdown =
    streak.amount !== undefined
      ? `${streak.count}× ${fmtExact(streak.amount)}`
      : `${streak.count} transactions`;
  const underlying = streak.transactionIds
    .map((id) => byId.get(id))
    .filter((t): t is Transaction => Boolean(t));
  const ids = streak.transactionIds;
  const allSel = areAllSelected(selection.selected, ids);
  const someSel = areSomeSelected(selection.selected, ids);

  return (
    <li className="text-sm">
      <div
        className={cn(
          "flex items-center gap-2 pl-1.5 pr-1",
          selection.selectionMode ? "" : "max-md:[&>label]:hidden",
        )}
      >
        <CheckboxCell
          show={selection.selectionMode}
          label={`Select ${streak.vendor} streak`}
          checked={allSel}
          indeterminate={someSel}
          onCheckedChange={(on) => selection.setMany(ids, on)}
        />
        <button
          type="button"
          data-row-key={streakRowKey}
          data-row-kind="streak"
          tabIndex={activeRowKey === streakRowKey ? 0 : -1}
          onFocus={() => onActivate(streakRowKey)}
          onClick={() => onToggleOpen(streakRowKey)}
          onKeyDown={(e) => {
            if (e.key === " ") {
              // Cancel the <button>'s native Space activation (which would
              // toggle the disclosure) and toggle the selection instead —
              // entering selection mode first so the checkboxes are visible.
              e.preventDefault();
              selection.enterSelectionMode();
              selection.setMany(ids, !allSel);
            }
            // Enter falls through to the native click → toggles the disclosure.
          }}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 self-center text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="text-foreground">{streak.vendor}</span>
            <span className="text-muted-foreground">
              {" · "}
              {breakdown}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 tabular-nums text-foreground",
              pageIsInflow && total > 0 && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            <SignedAmount kind={streakKind} amount={total} marker={false} />
          </span>
        </button>
      </div>
      {open && (
        <ul id={panelId}>
          {underlying.map((t) => (
            <Row
              key={t.id}
              rowKey={t.id}
              transaction={t}
              pageCategory={pageCategory}
              categoryById={categoryById}
              nested
              selection={selection}
              active={activeRowKey === t.id}
              onActivate={onActivate}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
