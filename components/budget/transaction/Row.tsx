"use client";

import { useRef } from "react";

import { CategoryPill } from "@/components/budget/category/CategoryPill";
import { SignedAmount } from "@/components/budget/charts/SignedAmount";
import { CheckboxCell } from "@/components/budget/transaction/CheckboxCell";
import { RowMenu } from "@/components/budget/transaction/RowMenu";
import type { TransactionSelection } from "@/hooks/useTransactionSelection";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";

export function Row({
  rowKey,
  transaction: t,
  pageCategory,
  categoryById,
  nested = false,
  selection,
  active,
  onActivate,
  onEdit,
  onDelete,
}: {
  rowKey: string;
  transaction: Transaction;
  /** Single page category in detail mode; undefined on the global list. */
  pageCategory: Category | undefined;
  categoryById: Map<string, Category>;
  /** Rendered inside an expanded streak — indent a level deeper to show nesting. */
  nested?: boolean;
  selection: TransactionSelection;
  active: boolean;
  onActivate: (key: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Detail rows share the page kind; global rows resolve their own from the
  // category map, and show a pill since the per-category context is gone.
  const cat = pageCategory ?? categoryById.get(t.categoryId);
  const kind = cat?.kind ?? "expense";
  const isInflow = kind !== "expense";
  const showPill = pageCategory === undefined && cat !== undefined;
  // Mobile long-press → selection mode (story 23). pointerdown starts a 500ms
  // timer; a pointerup, or movement past a small threshold, cancels it. The
  // threshold (~10px) keeps ordinary finger jitter from killing the gesture —
  // a zero-tolerance cancel reads as flaky on real touch devices. Touch only;
  // desktop reveals checkboxes always and uses click/keyboard.
  const LONG_PRESS_MOVE_TOLERANCE = 10;
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const cancelLongPress = () => {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
    longPressStart.current = null;
  };

  return (
    <li
      data-row-key={rowKey}
      data-row-kind="single"
      tabIndex={active ? 0 : -1}
      onFocus={() => onActivate(rowKey)}
      onKeyDown={(e) => {
        if (e.key === " ") {
          // Space selects the focused row, entering selection mode first so
          // the checkboxes are visible (parallels the mobile long-press).
          e.preventDefault();
          selection.enterSelectionMode();
          selection.toggle(t.id);
        } else if (e.key === "Enter") {
          e.preventDefault();
          // Open this row's overflow menu (story 21, "Enter opens row actions").
          e.currentTarget.querySelector<HTMLElement>("[data-row-menu]")?.click();
        }
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch") return;
        cancelLongPress();
        longPressStart.current = { x: e.clientX, y: e.clientY };
        longPress.current = setTimeout(() => {
          selection.enterSelectionMode();
          selection.toggle(t.id);
        }, 500);
      }}
      onPointerUp={cancelLongPress}
      onPointerMove={(e) => {
        const start = longPressStart.current;
        if (!start) return;
        if (
          Math.abs(e.clientX - start.x) > LONG_PRESS_MOVE_TOLERANCE ||
          Math.abs(e.clientY - start.y) > LONG_PRESS_MOVE_TOLERANCE
        ) {
          cancelLongPress();
        }
      }}
      onPointerCancel={cancelLongPress}
      className={cn(
        "group flex items-start gap-3 py-2 pr-1 text-sm outline-none focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        nested ? "pl-10" : "pl-5",
      )}
    >
      <CheckboxCell
        show={selection.selectionMode}
        label={`Select ${t.vendor ?? "transaction"}`}
        checked={selection.isSelected(t.id)}
        onCheckedChange={() => selection.toggle(t.id)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        {/* Wider gap to the amount than the in-row gaps so a truncated note
            clamps a touch early and never runs flush against the figure. */}
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-2">
            {showPill && cat && <CategoryPill category={cat} asLink={false} />}
            {/* Vendor and note share one truncating line so every row stays a
                uniform, scannable height. The vendor leads, so a long note
                ellipsizes before the vendor does (the vendor is the
                identifier); the full note is on hover and in the Edit sheet,
                and stays in the DOM for screen readers. */}
            <p className="truncate">
              <span className="sr-only">Vendor: </span>
              <span className="text-foreground">{t.vendor ?? "—"}</span>
              {t.note && (
                <span className="text-muted-foreground" title={t.note}>
                  <span aria-hidden> · </span>
                  <span className="sr-only">note: </span>
                  {t.note}
                </span>
              )}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 tabular-nums text-muted-foreground",
              isInflow && t.amount > 0 && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            <SignedAmount kind={kind} amount={t.amount} marker={false} />
          </span>
        </div>
      </div>
      <RowMenu onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}
