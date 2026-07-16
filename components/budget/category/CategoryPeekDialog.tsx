"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useMemo, useState } from "react";

import { RoleProvider } from "@/components/auth/RoleProvider";
import { DaySection } from "@/components/budget/transaction/DaySection";
import { MODAL_BACKDROP } from "@/components/ui/dialogClasses";
import { useTransactionSelection } from "@/hooks/useTransactionSelection";
import { groupTransactionsByDay } from "@/lib/transaction";
import type { Category, Transaction } from "@/types/budget";

/**
 * Recent-activity peek surface for a Categories-ledger row (issue #166 chunk 4,
 * stories 7–9): the category's last ~12 transactions shown **in place** so the
 * owner reviews without navigating to the detail page. A centered dialog on
 * desktop and a bottom sheet on mobile (one Base UI `Dialog`, responsive
 * positioning), opened by the row's sibling peek trigger.
 *
 * The list reuses the exact day-grouped presentation of the main transaction
 * lists (`DaySection` → `Row`/`StreakRow`), so it reads consistently (story 8).
 * It is **read-only for everyone**, including editors/owners — the peek is a
 * review affordance, not an entry point — so the body is wrapped in a
 * `viewer`-role provider, which makes every edit affordance those rows carry
 * (the ⋯ menu, selection checkboxes, long-press/Space) hide via `useCanEdit`
 * without any per-row plumbing. It renders every group directly (no window
 * virtualization): the set is capped upstream to ~12, and the virtualizer keys
 * off document scroll, which a modal's own scroll container can't drive.
 */
export function CategoryPeekDialog({
  open,
  onOpenChange,
  category,
  transactions,
  now,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  category: Category;
  /** Already sliced to the category's most-recent transactions (newest first). */
  transactions: Transaction[];
  now: Date;
}) {
  // Inert selection: the peek never enters selection mode (viewer role keeps
  // the affordances hidden), but DaySection/Row still need the object shape.
  const selection = useTransactionSelection();
  const [openStreaks, setOpenStreaks] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleStreak = useCallback((key: string) => {
    setOpenStreaks((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const dayGroups = useMemo(
    () => groupTransactionsByDay(transactions, { today: now }),
    [transactions, now],
  );
  const byId = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions],
  );
  // Detail mode: every row shares the page category, so the row lookup never
  // needs the global map — a single-entry map satisfies the type.
  const categoryById = useMemo(
    () => new Map([[category.id, category]]),
    [category],
  );
  const pageIsInflow = category.kind !== "expense";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={MODAL_BACKDROP} />
        <Dialog.Popup
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-card shadow-xl ring-1 ring-border outline-none transition-[opacity,transform] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[80vh] md:w-[min(480px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:data-[ending-style]:scale-95 md:data-[starting-style]:scale-95"
        >
          <div className="border-b border-border px-5 pb-3 pt-5">
            <Dialog.Title className="font-heading text-lg font-semibold">
              Recent activity in {category.name}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted-foreground">
              The category’s most recent transactions. Read-only — edit from the
              category page.
            </Dialog.Description>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
            <RoleProvider role="viewer">
              {dayGroups.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </p>
              ) : (
                dayGroups.map((group) => (
                  <DaySection
                    key={group.date}
                    group={group}
                    pageCategory={category}
                    pageIsInflow={pageIsInflow}
                    categoryById={categoryById}
                    byId={byId}
                    selection={selection}
                    activeRowKey={null}
                    onActivate={() => {}}
                    isStreakOpen={(key) => openStreaks.has(key)}
                    onToggleStreak={toggleStreak}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    headerClassName="top-0 bg-card"
                  />
                ))
              )}
            </RoleProvider>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
