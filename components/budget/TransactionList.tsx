"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { deleteTransactionAction } from "@/app/actions/transactions";
import { SignedAmount } from "@/components/budget/SignedAmount";
import { TransactionForm } from "@/components/budget/TransactionForm";
import { useNotify } from "@/components/notify";
import { DateRangeField } from "@/components/ui/DateRangeField";
import {
  fmtExact,
  matchesTransactionFilter,
  type TransactionFilter,
} from "@/lib/budget";
import {
  groupTransactionsByDay,
  type DayGroup,
  type TransactionRow,
} from "@/lib/transaction";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";

const UNDO_WINDOW_MS = 5000;
const EMPTY_FILTER: TransactionFilter = {
  text: "",
  vendor: "",
  dateFrom: "",
  dateTo: "",
};

// On desktop the Add transaction card is in the left rail and already in view,
// so a plain anchor link is silent. Move focus to the first input + flash a
// transient ring on the card so the click has visible feedback regardless of
// whether the scroll moved anything.
function focusAddTransactionForm() {
  const target = document.getElementById("add-transaction");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  // Skip hidden inputs (React server-action plumbing prepends several to
  // any `<form action={...}>`); the first visible control on the Add form
  // is the DatePickerField trigger button.
  const firstFocusable = target.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])',
  );
  firstFocusable?.focus({ preventScroll: true });
  target.classList.add("ring-2", "ring-ring");
  window.setTimeout(() => {
    target.classList.remove("ring-2", "ring-ring");
  }, 1200);
}

type Notify = ReturnType<typeof useNotify>;

type PendingDelete = {
  transaction: Transaction;
  timer: ReturnType<typeof setTimeout>;
  /** Stable id for the undo toast in the shared notify queue. */
  toastId: string;
  /**
   * `true` once the undo timer has fired and the action is awaiting. The row
   * stays hidden through the RTT (no optimistic flash), the unmount cleanup
   * skips firing the action a second time when work is already in progress,
   * and the toast's Undo button is disabled.
   */
  inFlight: boolean;
  /**
   * `true` once the action has resolved successfully and we're waiting for
   * the revalidated `transactions` prop to land. Until then the row stays
   * hidden — otherwise clearing pending eagerly causes a one-frame flash
   * where the row and total snap back to pre-delete state before
   * revalidation arrives.
   */
  awaitingRevalidation: boolean;
};

function reportDeleteError(notify: Notify) {
  return (result: { error: string | null }) => {
    if (!result.error) return;
    console.error("deleteTransactionAction failed:", result.error);
    notify.error("Delete failed", result.error);
  };
}

/**
 * Client-side transaction list for the category detail page (chunk 8 +
 * issue #10):
 *
 * - Filter row narrows by vendor / date range / free-text (stories 24, 64).
 * - Each row has a `…` overflow menu with Edit / Delete (story 43).
 * - Edit opens the shared TransactionForm in edit mode (story 44) — the
 *   category is editable inside that form for re-categorization (story 45).
 * - Delete is optimistic: the row disappears immediately and a custom toast
 *   in the shared `useNotify` queue offers ~5s to undo; on expiry the
 *   server delete fires (story 46, 47). No soft-delete. Navigating away
 *   during the window finalizes the delete (the action keeps running past
 *   the React unmount).
 */
export function TransactionList({
  category,
  categories,
  transactions,
  allTransactions,
  rangeText,
  now,
  isInflow,
  onHiddenIdChange,
}: {
  category: Category;
  categories: Category[];
  /** Already filtered to this category and the active range. */
  transactions: Transaction[];
  /** Full transaction set — the edit form's vendor/history helpers want it. */
  allTransactions: Transaction[];
  rangeText: string;
  now: Date;
  isInflow: boolean;
  /**
   * Reports the currently-hidden (optimistically-deleted) row id up to a
   * parent so sidebar aggregates can subtract the row and update headline
   * totals immediately. Undefined when no row is hidden.
   */
  onHiddenIdChange?: (id: string | undefined) => void;
}) {
  const [filter, setFilter] = useState<TransactionFilter>(EMPTY_FILTER);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const notify = useNotify();

  // Flush any pending delete when the component unmounts. The user's last
  // intent was "delete this row"; navigating away before the timer fires
  // shouldn't silently resurrect it. We fire-and-forget the action — the
  // POST continues past the React unmount and the action's revalidatePath
  // calls flush the route cache. When the timer has already fired
  // (`inFlight`), the action is in progress; the timer callback will dismiss
  // the toast when it completes, so we just leave it alone.
  const pendingRef = useRef<PendingDelete | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    return () => {
      const p = pendingRef.current;
      if (!p) return;
      clearTimeout(p.timer);
      if (p.inFlight) return;
      // Take the toast out of "you can undo" mode immediately — the user
      // navigated away, so the action's going to commit and Undo can't
      // rescue it. The toast self-dismisses once the action resolves.
      notify.update(p.toastId, {
        data: {
          vendorLabel: p.transaction.vendor ?? "transaction",
          inFlight: true,
          onUndo: () => {},
        },
      });
      void deleteTransactionAction({
        id: p.transaction.id,
        categoryId: p.transaction.categoryId,
      }).then((result) => {
        reportDeleteError(notify)(result);
        notify.dismiss(p.toastId);
      });
    };
    // notify is referentially stable across renders (memoized by useNotify);
    // closing over it for the unmount cleanup is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startDelete(transaction: Transaction) {
    // Stacking deletes: clicking Delete while a prior toast is showing
    // finalizes the prior delete and starts a new toast. If the prior is
    // already in flight, leave it alone — its own timer callback will
    // dismiss its toast when the action resolves.
    if (pending) {
      clearTimeout(pending.timer);
      if (!pending.inFlight) {
        const prior = pending.transaction;
        notify.dismiss(pending.toastId);
        void deleteTransactionAction({
          id: prior.id,
          categoryId: prior.categoryId,
        }).then(reportDeleteError(notify));
      }
    }

    // The same transaction can only be in one pending-delete slot at a time
    // (deleting hides the row), so a stable id per transaction is collision-
    // free here. Reusing it after a prior toast dismissed is fine — Base UI
    // treats `add({id})` as upsert.
    const toastId = `undo-delete:${transaction.id}`;
    const vendorLabel = transaction.vendor ?? "transaction";

    const timer = setTimeout(async () => {
      // Flip to in-flight *before* awaiting so the unmount cleanup doesn't
      // double-fire, the row stays hidden through the action's RTT, and the
      // toast's Undo button is disabled. Without this, `setPending(null)`
      // ran synchronously and the row flashed back for one render before
      // revalidation rebuilt the parent.
      setPending((cur) =>
        cur?.transaction.id === transaction.id ? { ...cur, inFlight: true } : cur,
      );
      notify.update(toastId, {
        data: { vendorLabel, inFlight: true, onUndo: () => {} },
      });
      const result = await deleteTransactionAction({
        id: transaction.id,
        categoryId: transaction.categoryId,
      });
      notify.dismiss(toastId);
      if (result.error) {
        reportDeleteError(notify)(result);
        setPending((cur) => (cur?.transaction.id === transaction.id ? null : cur));
        return;
      }
      // Action succeeded. Don't clear pending yet — the row must stay hidden
      // until the revalidated `transactions` prop arrives, or the user sees
      // the row + total snap back for one frame before disappearing again.
      // A useEffect on `transactions` clears pending once the prop catches
      // up (or — defensively — after a short fallback timeout).
      setPending((cur) =>
        cur?.transaction.id === transaction.id
          ? { ...cur, awaitingRevalidation: true }
          : cur,
      );
    }, UNDO_WINDOW_MS);

    notify.undoDelete({
      id: toastId,
      vendorLabel,
      onUndo: () =>
        setPending((cur) => {
          if (!cur || cur.toastId !== toastId || cur.inFlight) return cur;
          clearTimeout(cur.timer);
          notify.dismiss(cur.toastId);
          return null;
        }),
    });

    setPending({
      transaction,
      timer,
      toastId,
      inFlight: false,
      awaitingRevalidation: false,
    });
  }

  // Clear pending once the revalidated `transactions` prop no longer contains
  // the deleted row. The row stays hidden through the action RTT *and* the
  // revalidation propagation, eliminating the one-frame flash that happened
  // when pending cleared eagerly on action resolve.
  //
  // Implemented as a render-time check against the previous `transactions`
  // reference rather than a useEffect — React 19's `set-state-in-effect`
  // rule forbids setState inside an effect, and this is the canonical
  // "adjust state when a prop changes" pattern from the React docs.
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  if (transactions !== prevTransactions) {
    setPrevTransactions(transactions);
    if (
      pending?.awaitingRevalidation &&
      !transactions.some((t) => t.id === pending.transaction.id)
    ) {
      setPending(null);
    }
  }

  const hiddenId = pending?.transaction.id;
  // Mirror the hidden id up to the parent so sidebar aggregates can subtract
  // it (story 46-adjacent — totals should match the visible list).
  useEffect(() => {
    onHiddenIdChange?.(hiddenId);
  }, [hiddenId, onHiddenIdChange]);
  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (t.id === hiddenId) return false;
        return matchesTransactionFilter(t, filter);
      }),
    [transactions, filter, hiddenId],
  );

  const vendorOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const t of transactions) {
      const v = t.vendor?.trim();
      if (v) seen.add(v);
    }
    return [...seen].sort();
  }, [transactions]);

  // Day grouping (chunk 2 of #17): the chunk-1 `groupTransactionsByDay` helper
  // gives us newest-first day buckets with signed subtotals and "Today"/
  // "Yesterday"/"Mon, Jun 8" labels. Streak collapse is *not* wired here — we
  // expand each group's rows back to individual transactions so every
  // transaction still renders as its own row. Chunk 3 swaps `expandRows` for
  // direct streak rendering.
  const dayGroups = useMemo(
    () => groupTransactionsByDay(filtered, { today: now }),
    [filtered, now],
  );
  const txById = useMemo(
    () => new Map(filtered.map((t) => [t.id, t])),
    [filtered],
  );

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-medium">
          {filtered.length} transactions · {rangeText.toLowerCase()}
        </h2>
      </div>

      <FilterRow filter={filter} onChange={setFilter} vendorOptions={vendorOptions} />

      {filtered.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl bg-card px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-border">
          {transactions.length === 0 ? (
            <>
              <p>No transactions in this range.</p>
              {!category.activeUntil && (
                <button
                  type="button"
                  onClick={focusAddTransactionForm}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Add a transaction →
                </button>
              )}
            </>
          ) : (
            <>
              <p>No transactions match the filter.</p>
              <button
                type="button"
                onClick={() => setFilter(EMPTY_FILTER)}
                className="cursor-pointer rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3">
          {dayGroups.map((group) => (
            <DaySection
              key={group.date}
              group={group}
              kind={category.kind}
              isInflow={isInflow}
              transactions={expandRows(group.rows, txById)}
              onEdit={setEditing}
              onDelete={startDelete}
            />
          ))}
        </div>
      )}

      <EditDialog
        editing={editing}
        onClose={() => setEditing(null)}
        categories={categories}
        allTransactions={allTransactions}
      />
    </>
  );
}

function FilterRow({
  filter,
  onChange,
  vendorOptions,
}: {
  filter: TransactionFilter;
  onChange: (next: TransactionFilter) => void;
  vendorOptions: string[];
}) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-2xl bg-card p-3 ring-1 ring-border sm:grid-cols-[1fr_160px_minmax(220px,1fr)]">
      <input
        type="search"
        placeholder="Search vendor or note…"
        value={filter.text ?? ""}
        onChange={(e) => onChange({ ...filter, text: e.target.value })}
        aria-label="Search"
        className="rounded-md bg-background px-3 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
      <select
        value={filter.vendor ?? ""}
        onChange={(e) => onChange({ ...filter, vendor: e.target.value })}
        aria-label="Vendor"
        className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      >
        <option value="">All vendors</option>
        {vendorOptions.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <DateRangeField
        from={filter.dateFrom ?? ""}
        to={filter.dateTo ?? ""}
        onChange={({ from, to }) =>
          onChange({ ...filter, dateFrom: from, dateTo: to })
        }
        ariaLabel="Date range"
        placeholder="Any date"
      />
    </div>
  );
}

/**
 * Flattens a day's grouped rows back into individual transactions. Chunk 2
 * renders every transaction as its own row, so a `CollapsedStreak` is expanded
 * to its underlying transactions (looked up by id, preserving the streak's
 * member order). Chunk 3 will drop this and render streaks as collapsed rows.
 */
function expandRows(
  rows: TransactionRow[],
  byId: Map<string, Transaction>,
): Transaction[] {
  const out: Transaction[] = [];
  for (const row of rows) {
    if (row.kind === "single") {
      out.push(row.transaction);
    } else {
      for (const id of row.transactionIds) {
        const t = byId.get(id);
        if (t) out.push(t);
      }
    }
  }
  return out;
}

/**
 * One day rendered agenda-style: a strong, sticky day header (bold label +
 * bold signed subtotal, on a hairline rule) with its transactions indented
 * beneath it (stories 1, 2, 3, 27). No surrounding card — most days hold only
 * a row or two, so a box per day reads as heavy clutter. The weight contrast
 * (header bold / rows regular) and the indent make the header lead and the
 * day boundaries easy to scan.
 *
 * The section is an ARIA region named by day + subtotal for screen-reader
 * day-to-day navigation (story 22). The header sits on the page background and
 * sticks below the global app header (`h-14`); its solid background masks rows
 * passing underneath when pinned.
 */
function DaySection({
  group,
  kind,
  isInflow,
  transactions,
  onEdit,
  onDelete,
}: {
  group: DayGroup;
  kind: Category["kind"];
  isInflow: boolean;
  transactions: Transaction[];
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const subtotalPositive = isInflow && group.subtotal > 0;
  return (
    <section aria-label={`${group.label}, ${fmtExact(group.subtotal)}`}>
      <h3 className="sticky top-14 z-10 flex items-baseline justify-between gap-2 border-b border-border bg-background px-1 pb-1.5 pt-4 text-sm font-semibold">
        <span className="text-foreground">{group.label}</span>
        <span
          className={cn(
            "tabular-nums text-foreground",
            subtotalPositive && "text-emerald-700 dark:text-emerald-400",
          )}
        >
          <SignedAmount kind={kind} amount={group.subtotal} />
        </span>
      </h3>
      <ul>
        {transactions.map((t) => (
          <Row
            key={t.id}
            transaction={t}
            kind={kind}
            isInflow={isInflow}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t)}
          />
        ))}
      </ul>
    </section>
  );
}

function Row({
  transaction: t,
  kind,
  isInflow,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  kind: Category["kind"];
  isInflow: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group flex items-start gap-3 py-2 pl-5 pr-1 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-foreground">
            <span className="sr-only">Vendor: </span>
            {t.vendor ?? "—"}
          </p>
          <span
            className={cn(
              "shrink-0 tabular-nums text-muted-foreground",
              isInflow && t.amount > 0 && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            <SignedAmount kind={kind} amount={t.amount} marker={false} />
          </span>
        </div>
        {t.note && <p className="mt-0.5 text-xs text-muted-foreground">{t.note}</p>}
      </div>
      <RowMenu onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Row actions"
        // Always visible on mobile/touch; on desktop the ⋯ stays hidden until
        // the row is hovered or something inside it gains focus (keyboard),
        // and while its own menu is open — keeps the trailing column quiet.
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:data-[popup-open]:opacity-100"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end" className="z-30 outline-none">
          <Menu.Popup className="min-w-40 rounded-xl bg-card p-1 text-sm shadow-xl ring-1 ring-border outline-none">
            <Menu.Item
              onClick={onEdit}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
            >
              <Pencil className="size-4 text-muted-foreground" aria-hidden />
              Edit
            </Menu.Item>
            <Menu.Item
              onClick={onDelete}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-rose-700 outline-none data-[highlighted]:bg-rose-50 dark:text-rose-400 dark:data-[highlighted]:bg-rose-950"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function EditDialog({
  editing,
  onClose,
  categories,
  allTransactions,
}: {
  editing: Transaction | null;
  onClose: () => void;
  categories: Category[];
  allTransactions: Transaction[];
}) {
  return (
    <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Edit transaction
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Change any field and save. Re-categorize via the category picker.
          </Dialog.Description>
          {editing && (
            <div className="mt-4">
              <TransactionForm
                categories={categories}
                transactions={allTransactions}
                editing={editing}
                onSuccess={onClose}
              />
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
