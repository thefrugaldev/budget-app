"use client";

import { Check, ListChecks } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  bulkDeleteTransactionsAction,
  bulkUpdateTransactionsAction,
  deleteTransactionAction,
} from "@/app/actions/transactions";
import { BulkActionBar } from "@/components/budget/transaction/BulkActionBar";
import { DaySection } from "@/components/budget/transaction/DaySection";
import { EditDialog } from "@/components/budget/transaction/EditDialog";
import { FilterRow } from "@/components/budget/transaction/FilterRow";
import { Checkbox } from "@/components/ui/Checkbox";
import { useNotify } from "@/hooks/useNotify";
import { useTransactionSelection } from "@/hooks/useTransactionSelection";
import { matchesTransactionFilter } from "@/lib/budget";
import { groupTransactionsByDay, streakKey } from "@/lib/transaction";
import {
  allTransactionIds,
  areAllSelected,
  areSomeSelected,
  distinctVendors,
  mostCommonVendor,
  selectedTotal,
} from "@/lib/transaction-selection";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind, Transaction } from "@/types/budget";
import type { TransactionFilter } from "@/types/transaction";

const UNDO_WINDOW_MS = 5000;
const EMPTY_FILTER: TransactionFilter = {
  text: "",
  vendor: "",
  dateFrom: "",
  dateTo: "",
};

function pluralTxns(n: number): string {
  return `${n} ${n === 1 ? "transaction" : "transactions"}`;
}

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

/** Bulk-delete counterpart of `PendingDelete` — same machine over many ids. */
type PendingBulkDelete = {
  ids: string[];
  categoryIds: string[];
  count: number;
  timer: ReturnType<typeof setTimeout>;
  toastId: string;
  inFlight: boolean;
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
 * Client-side transaction list shared by the category detail page (chunk 8 +
 * issue #10) and the global `/transactions` route (#17 chunk 5), extended for
 * grouping/collapse/selection in #17:
 *
 * - Filter row narrows by vendor / date range / free-text (stories 24, 64);
 *   the global list adds a category multi-select (#17 chunk 5, story 18).
 * - Day-grouped, newest-first, with sticky headers + signed subtotals; runs of
 *   the same vendor within a day collapse to an expandable streak (#17 1–6).
 * - Each row has a `…` overflow menu with Edit / Delete (story 43) and a
 *   selection checkbox; day headers and a top-level control offer select-all
 *   (#17 7–9). With ≥1 row selected a bulk action bar appears for delete /
 *   recategorise / rename (#17 10–16).
 * - Keyboard: the list is one tab stop; arrow keys rove between rows, Space
 *   toggles selection, Enter opens a row's menu (or expands a streak) (#17 21).
 * - Mobile: long-press a row to enter selection mode, then tap to toggle (#17 23).
 * - Delete (single and bulk) is optimistic with a ~5s undo toast; recategorise
 *   and rename await the server and revalidate (#17 16).
 *
 * Pass `category` for the single-category detail list — every row shares its
 * kind and the empty state offers "Add a transaction". Omit it for the global
 * list: each row resolves its own kind from `categories`, renders a category
 * pill (story 19), and day subtotals net across kinds as plain signed sums.
 */
export function TransactionList({
  category,
  categories,
  transactions,
  allTransactions,
  rangeText,
  now,
  onHiddenIdsChange,
  filter: filterProp,
  onFilterChange,
}: {
  /**
   * The page category in single-category (detail) mode. Omitted on the global
   * `/transactions` list, where rows span categories and each resolves its own
   * kind + pill from `categories`.
   */
  category?: Category;
  categories: Category[];
  /** Already filtered to the active range (and, in detail mode, one category). */
  transactions: Transaction[];
  /** Full transaction set — the edit form's vendor/history helpers want it. */
  allTransactions: Transaction[];
  rangeText: string;
  now: Date;
  /**
   * Reports the currently-hidden (optimistically-deleted) row ids up to a
   * parent so sidebar aggregates can subtract them and update headline totals
   * immediately. Covers both the single-row and bulk delete paths.
   */
  onHiddenIdsChange?: (ids: string[]) => void;
  /**
   * Controlled filter state. The global `/transactions` list passes these to
   * bind the filter to the URL (story 8); the category-detail list omits them
   * and falls back to internal state.
   */
  filter?: TransactionFilter;
  onFilterChange?: (next: TransactionFilter) => void;
}) {
  const [localFilter, setLocalFilter] = useState<TransactionFilter>(EMPTY_FILTER);
  const filter = filterProp ?? localFilter;
  const setFilter = onFilterChange ?? setLocalFilter;
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [bulkPending, setBulkPending] = useState<PendingBulkDelete | null>(null);
  const notify = useNotify();
  const selection = useTransactionSelection();

  // Global mode: no single page category, so every row looks up its own kind
  // and pill here. `pageIsInflow` only colours subtotals/totals green in
  // detail mode — a global day nets across kinds, so its sign carries the
  // meaning, not a colour.
  const isGlobal = category === undefined;
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const pageIsInflow = category ? category.kind !== "expense" : false;

  // Category lookup over the in-range set so bulk actions can collect the
  // distinct categories of a selection (one on this page, potentially many
  // once the global `/transactions` list reuses this component in chunk 5).
  const categoryIdsFor = useCallback(
    (ids: string[]) => {
      const byId = new Map(transactions.map((t) => [t.id, t.categoryId]));
      return [...new Set(ids.map((id) => byId.get(id)).filter((c): c is string => Boolean(c)))];
    },
    [transactions],
  );

  // Flush any pending delete when the component unmounts. The user's last
  // intent was "delete"; navigating away before the timer fires shouldn't
  // silently resurrect the rows. We fire-and-forget — the POST continues past
  // the React unmount and the action's revalidatePath flushes the route cache.
  const pendingRef = useRef<PendingDelete | null>(null);
  const bulkPendingRef = useRef<PendingBulkDelete | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    bulkPendingRef.current = bulkPending;
  }, [bulkPending]);
  useEffect(() => {
    return () => {
      const p = pendingRef.current;
      if (p) {
        clearTimeout(p.timer);
        if (!p.inFlight) {
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
        }
      }

      const b = bulkPendingRef.current;
      if (b) {
        clearTimeout(b.timer);
        if (!b.inFlight) {
          notify.update(b.toastId, {
            data: { vendorLabel: pluralTxns(b.count), inFlight: true, onUndo: () => {} },
          });
          void bulkDeleteTransactionsAction({ ids: b.ids, categoryIds: b.categoryIds }).then(
            (result) => {
              if (result.error) notify.error("Delete failed", result.error);
              notify.dismiss(b.toastId);
            },
          );
        }
      }
    };
    // notify is referentially stable across renders (memoized by useNotify).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startDelete(transaction: Transaction) {
    // Stacking deletes: clicking Delete while a prior toast is showing
    // finalizes the prior delete and starts a new toast. If the prior is
    // already in flight, leave it alone — its own timer callback dismisses it.
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

    const toastId = `undo-delete:${transaction.id}`;
    const vendorLabel = transaction.vendor ?? "transaction";

    const timer = setTimeout(async () => {
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

  // Bulk delete: same optimistic-hide + undo machine as single delete, over a
  // snapshot of the selected ids. Selection is cleared immediately so the bar
  // dismisses; the rows stay hidden via `hiddenIds` until the timer fires and
  // the server delete + revalidation land (or the user undoes).
  function startBulkDelete() {
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    const categoryIds = categoryIdsFor(ids);
    const count = ids.length;
    const toastId = "undo-bulk-delete";

    // Only one bulk-delete in flight at a time; finalize any prior immediately.
    if (bulkPending) {
      clearTimeout(bulkPending.timer);
      if (!bulkPending.inFlight) {
        const prior = bulkPending;
        notify.dismiss(prior.toastId);
        void bulkDeleteTransactionsAction({
          ids: prior.ids,
          categoryIds: prior.categoryIds,
        }).then((r) => r.error && notify.error("Delete failed", r.error));
      }
    }

    selection.cancel();

    const timer = setTimeout(async () => {
      setBulkPending((cur) => (cur?.toastId === toastId ? { ...cur, inFlight: true } : cur));
      notify.update(toastId, {
        data: { vendorLabel: pluralTxns(count), inFlight: true, onUndo: () => {} },
      });
      const result = await bulkDeleteTransactionsAction({ ids, categoryIds });
      notify.dismiss(toastId);
      if (result.error) {
        notify.error("Delete failed", result.error);
        setBulkPending((cur) => (cur?.toastId === toastId ? null : cur));
        return;
      }
      setBulkPending((cur) =>
        cur?.toastId === toastId ? { ...cur, awaitingRevalidation: true } : cur,
      );
    }, UNDO_WINDOW_MS);

    notify.undoBulkDelete({
      id: toastId,
      count,
      onUndo: () =>
        setBulkPending((cur) => {
          if (!cur || cur.toastId !== toastId || cur.inFlight) return cur;
          clearTimeout(cur.timer);
          notify.dismiss(cur.toastId);
          return null;
        }),
    });

    setBulkPending({
      ids,
      categoryIds,
      count,
      timer,
      toastId,
      inFlight: false,
      awaitingRevalidation: false,
    });
  }

  async function handleBulkRecategorise(categoryId: string) {
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    const categoryIds = categoryIdsFor(ids);
    const target = categories.find((c) => c.id === categoryId);
    selection.cancel();
    const result = await bulkUpdateTransactionsAction({
      ids,
      categoryIds,
      patch: { categoryId },
    });
    if (result.error) notify.error("Recategorise failed", result.error);
    else
      notify.success(
        `${pluralTxns(result.updated)} moved`,
        target ? `Now in ${target.name}` : undefined,
      );
  }

  async function handleBulkRename(vendor: string) {
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    const categoryIds = categoryIdsFor(ids);
    selection.cancel();
    const result = await bulkUpdateTransactionsAction({
      ids,
      categoryIds,
      patch: { vendor },
    });
    if (result.error) notify.error("Rename failed", result.error);
    else notify.success(`Renamed ${pluralTxns(result.updated)}`, `Vendor set to "${vendor}"`);
  }

  // Clear pending once the revalidated `transactions` prop no longer contains
  // the deleted rows — keeping them hidden through the action RTT *and* the
  // revalidation propagation eliminates the one-frame flash. Implemented as a
  // render-time check against the previous prop reference (React 19 forbids
  // setState inside an effect; this is the documented "adjust state on prop
  // change" pattern).
  const [prevTransactions, setPrevTransactions] = useState(transactions);
  if (transactions !== prevTransactions) {
    setPrevTransactions(transactions);
    if (
      pending?.awaitingRevalidation &&
      !transactions.some((t) => t.id === pending.transaction.id)
    ) {
      setPending(null);
    }
    if (
      bulkPending?.awaitingRevalidation &&
      !transactions.some((t) => bulkPending.ids.includes(t.id))
    ) {
      setBulkPending(null);
    }
  }

  const hiddenIds = useMemo(() => {
    const ids = new Set<string>();
    if (pending) ids.add(pending.transaction.id);
    if (bulkPending) for (const id of bulkPending.ids) ids.add(id);
    return ids;
  }, [pending, bulkPending]);

  const hiddenKey = [...hiddenIds].sort().join(",");
  useEffect(() => {
    onHiddenIdsChange?.([...hiddenIds]);
    // hiddenKey captures the set's contents; hiddenIds identity changes with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiddenKey, onHiddenIdsChange]);

  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        if (hiddenIds.has(t.id)) return false;
        return matchesTransactionFilter(t, filter);
      }),
    [transactions, filter, hiddenIds],
  );

  // Keep the selection within the visible set: when the filter (or the
  // underlying data) narrows, drop any selected ids that scrolled out of view,
  // so the bar count, the bar total, and every bulk action operate on exactly
  // what's on screen — never on rows the user can't currently see. Without
  // this, narrowing a date range after a select-all would still delete /
  // recategorise the now-hidden rows. Render-time prop-change adjustment, the
  // same pattern as the revalidation-clear below (setState in an effect is
  // disallowed here).
  const filteredIdsKey = useMemo(() => filtered.map((t) => t.id).join(","), [filtered]);
  const [prevFilteredIdsKey, setPrevFilteredIdsKey] = useState(filteredIdsKey);
  if (filteredIdsKey !== prevFilteredIdsKey) {
    setPrevFilteredIdsKey(filteredIdsKey);
    const visible = new Set(filtered.map((t) => t.id));
    const stale = [...selection.selected].filter((id) => !visible.has(id));
    if (stale.length > 0) selection.deselectMany(stale);
  }

  const vendorOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const t of transactions) {
      const v = t.vendor?.trim();
      if (v) seen.add(v);
    }
    return [...seen].sort();
  }, [transactions]);

  // Day grouping runs on the *filtered* set, so a date filter that cuts a
  // streak only collapses the in-range portion (story 24), and an optimistic
  // delete shrinks (or dissolves) a streak the moment its rows hide (story 6).
  const dayGroups = useMemo(
    () => groupTransactionsByDay(filtered, { today: now }),
    [filtered, now],
  );
  const txById = useMemo(
    () => new Map(filtered.map((t) => [t.id, t])),
    [filtered],
  );

  // Streak expansion is lifted here (not local to each StreakRow) so the
  // keyboard nav can compute the full navigable row order including the
  // children of expanded streaks. "Expand all" forces every streak open.
  const [expandAll, setExpandAll] = useState(false);
  const [expandedStreaks, setExpandedStreaks] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleStreak = useCallback((key: string) => {
    setExpandedStreaks((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const isStreakOpen = useCallback(
    (key: string) => expandAll || expandedStreaks.has(key),
    [expandAll, expandedStreaks],
  );
  const hasStreaks = useMemo(
    () => dayGroups.some((g) => g.rows.some((r) => r.kind === "streak")),
    [dayGroups],
  );

  // Flattened, DOM-order list of navigable row keys for roving-tabindex arrow
  // navigation. A streak header contributes its own key, then (when open) each
  // underlying row id, matching what's rendered.
  const orderedRowKeys = useMemo(() => {
    const keys: string[] = [];
    for (const group of dayGroups) {
      for (const row of group.rows) {
        if (row.kind === "single") {
          keys.push(row.transaction.id);
        } else {
          const key = streakKey(group.date, row.vendor);
          keys.push(key);
          if (isStreakOpen(key)) {
            for (const id of row.transactionIds) {
              if (txById.has(id)) keys.push(id);
            }
          }
        }
      }
    }
    return keys;
  }, [dayGroups, isStreakOpen, txById]);

  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const effectiveActiveKey =
    activeRowKey && orderedRowKeys.includes(activeRowKey)
      ? activeRowKey
      : (orderedRowKeys[0] ?? null);

  const listRef = useRef<HTMLDivElement>(null);
  const focusRow = useCallback((key: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-row-key="${CSS.escape(key)}"]`,
    );
    if (el) {
      el.focus();
      setActiveRowKey(key);
    }
  }, []);

  // Container-level arrow / Home / End navigation. Space and Enter are handled
  // on each row element (the streak header is a <button> whose native Space
  // would otherwise toggle the disclosure instead of the selection).
  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const activeEl = (e.target as HTMLElement).closest<HTMLElement>("[data-row-key]");
      const keys = orderedRowKeys;
      if (keys.length === 0) return;
      const idx = activeEl ? keys.indexOf(activeEl.dataset.rowKey ?? "") : -1;
      e.preventDefault();
      if (e.key === "ArrowDown") focusRow(keys[Math.min(idx + 1, keys.length - 1)] ?? keys[0]);
      else if (e.key === "ArrowUp") focusRow(keys[Math.max(idx - 1, 0)] ?? keys[0]);
      else if (e.key === "Home") focusRow(keys[0]);
      else focusRow(keys[keys.length - 1]);
    },
    [orderedRowKeys, focusRow],
  );

  // Top-level select-all spans every row in the current filter/range (story 9).
  const allIds = useMemo(() => allTransactionIds(dayGroups), [dayGroups]);
  const selectedTotalValue = useMemo(
    () => selectedTotal(filtered, selection.selected),
    [filtered, selection.selected],
  );
  const defaultVendor = useMemo(
    () => mostCommonVendor(filtered, selection.selected),
    [filtered, selection.selected],
  );
  // Distinct vendors in the selection — a bulk rename across more than one is
  // a deliberate "merge these spellings" action, so the rename dialog warns
  // before collapsing them (issue #17 chunk 5 follow-up).
  const selectedVendors = useMemo(
    () => distinctVendors(filtered, selection.selected),
    [filtered, selection.selected],
  );

  // Kind shown on the bulk bar (drives the selection total's sign convention
  // and the cross-kind recategorise confirm). In detail mode it's the page
  // category's kind; in global mode the selection can straddle kinds, so use
  // the shared kind when every selected row agrees, falling back to "expense"
  // (a net, plus-less rendering — and a cross-kind confirm fires whenever the
  // target isn't an expense category).
  const bulkKind: CategoryKind = useMemo(() => {
    if (category) return category.kind;
    let kind: CategoryKind | undefined;
    for (const id of selection.selected) {
      // `txById` keyed lookup, not `filtered.find` — a select-all over a few
      // thousand rows would otherwise be O(n²) and stall the main thread.
      const k = categoryById.get(txById.get(id)?.categoryId ?? "")?.kind;
      if (!k) continue;
      if (kind === undefined) kind = k;
      else if (kind !== k) return "expense";
    }
    return kind ?? "expense";
  }, [category, selection.selected, categoryById, txById]);

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* Top-level select-all only exists while selecting — the resting
              list is for reading, not managing (issue #17 chunk 4 follow-up). */}
          {selection.selectionMode && filtered.length > 0 && (
            <Checkbox
              label="Select all transactions"
              checked={areAllSelected(selection.selected, allIds)}
              indeterminate={areSomeSelected(selection.selected, allIds)}
              onCheckedChange={(on) => selection.setMany(allIds, on)}
              className="self-center"
            />
          )}
          <h2 className="truncate font-heading text-lg font-medium">
            {filtered.length} transactions · {rangeText.toLowerCase()}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasStreaks && (
            <button
              type="button"
              onClick={() => setExpandAll((v) => !v)}
              aria-pressed={expandAll}
              className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expandAll ? "Collapse all" : "Expand all"}
            </button>
          )}
          {/* Selection is an explicit mode entered here (or via long-press on
              mobile / Space on a focused row) — checkboxes stay out of the
              default reading view until asked for. Kept available while in mode
              even if a filter empties the list, so there's always an exit. */}
          {(filtered.length > 0 || selection.selectionMode) && (
            <button
              type="button"
              onClick={() =>
                selection.selectionMode
                  ? selection.cancel()
                  : selection.enterSelectionMode()
              }
              aria-pressed={selection.selectionMode}
              // Given more weight than "Expand all" (an outlined chip with an
              // icon, not a ghost link) so it reads as the gateway to bulk
              // actions rather than a passive label; filled while active so the
              // selection mode is unmistakable.
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selection.selectionMode
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-foreground ring-1 ring-border hover:bg-muted",
              )}
            >
              {selection.selectionMode ? (
                <Check className="size-3.5" aria-hidden />
              ) : (
                <ListChecks className="size-3.5" aria-hidden />
              )}
              {selection.selectionMode ? "Done" : "Select"}
            </button>
          )}
        </div>
      </div>

      <FilterRow
        filter={filter}
        onChange={setFilter}
        vendorOptions={vendorOptions}
        categories={isGlobal ? categories : undefined}
      />

      {filtered.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl bg-card px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-border">
          {transactions.length === 0 ? (
            <>
              <p>No transactions in this range.</p>
              {/* Detail mode offers a jump to the left-rail Add form; the
                  global list has no add affordance, so it just states the
                  empty range. */}
              {category && !category.activeUntil && (
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
        <div
          className="mt-3"
          ref={listRef}
          onKeyDown={onListKeyDown}
          // Pad the bottom while the bulk bar is up so its float doesn't cover
          // the last rows (the bar is ~56px tall plus the mobile tab clearance).
          style={selection.count > 0 ? { paddingBottom: "5rem" } : undefined}
        >
          {dayGroups.map((group) => (
            <DaySection
              key={group.date}
              group={group}
              pageCategory={category}
              pageIsInflow={pageIsInflow}
              categoryById={categoryById}
              byId={txById}
              selection={selection}
              activeRowKey={effectiveActiveKey}
              onActivate={setActiveRowKey}
              isStreakOpen={isStreakOpen}
              onToggleStreak={toggleStreak}
              onEdit={setEditing}
              onDelete={startDelete}
            />
          ))}
        </div>
      )}

      {selection.count > 0 && (
        <BulkActionBar
          count={selection.count}
          total={selectedTotalValue}
          kind={bulkKind}
          defaultVendor={defaultVendor}
          selectedVendors={selectedVendors}
          categories={categories}
          onDelete={startBulkDelete}
          onRecategorise={handleBulkRecategorise}
          onRename={handleBulkRename}
          onCancel={selection.cancel}
        />
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
