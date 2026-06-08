"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { deleteTransactionAction } from "@/app/actions/transactions";
import { SignedAmount } from "@/components/budget/SignedAmount";
import { TransactionForm } from "@/components/budget/TransactionForm";
import {
  dayLabel,
  matchesTransactionFilter,
  type TransactionFilter,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";

const UNDO_WINDOW_MS = 5000;
const EMPTY_FILTER: TransactionFilter = {
  text: "",
  vendor: "",
  dateFrom: "",
  dateTo: "",
};

type PendingDelete = {
  transaction: Transaction;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Client-side transaction list for the category detail page (chunk 8):
 *
 * - Filter row narrows by vendor / date range / free-text (stories 24, 64).
 * - Each row has a `…` overflow menu with Edit / Delete (story 43).
 * - Edit opens the shared TransactionForm in edit mode (story 44) — the
 *   category is editable inside that form for re-categorization (story 45).
 * - Delete is optimistic: the row disappears immediately and a toast offers
 *   ~5s to undo; on expiry the server delete fires (story 46, 47). No soft-
 *   delete. Navigating away during the window cancels the delete.
 */
export function TransactionList({
  category,
  categories,
  transactions,
  allTransactions,
  rangeText,
  now,
  isInflow,
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
}) {
  const [filter, setFilter] = useState<TransactionFilter>(EMPTY_FILTER);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);

  // Flush any pending delete when the component unmounts. The user's last
  // intent was "delete this row"; navigating away (or otherwise unmounting
  // the list) before the timer fires shouldn't silently resurrect it. We
  // fire-and-forget the action — the POST continues in the browser past the
  // React unmount, and the action's revalidatePath calls flush the route
  // cache so the next render of the budget / detail pages reflects the delete.
  const pendingRef = useRef<PendingDelete | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    return () => {
      const p = pendingRef.current;
      if (!p) return;
      clearTimeout(p.timer);
      void deleteTransactionAction({
        id: p.transaction.id,
        categoryId: p.transaction.categoryId,
      });
    };
  }, []);

  function startDelete(transaction: Transaction) {
    // Stacking deletes: clicking Delete while a previous toast is showing
    // finalizes the prior delete and starts a new toast. Single-slot UI keeps
    // the bottom-left corner uncluttered.
    if (pending) {
      clearTimeout(pending.timer);
      const prior = pending.transaction;
      void deleteTransactionAction({ id: prior.id, categoryId: prior.categoryId });
    }
    const timer = setTimeout(() => {
      void deleteTransactionAction({
        id: transaction.id,
        categoryId: transaction.categoryId,
      });
      setPending((cur) => (cur?.transaction.id === transaction.id ? null : cur));
    }, UNDO_WINDOW_MS);
    setPending({ transaction, timer });
  }

  function undoDelete() {
    if (!pending) return;
    clearTimeout(pending.timer);
    setPending(null);
  }

  const hiddenId = pending?.transaction.id;
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

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-lg font-medium">
          {filtered.length} transactions · {rangeText.toLowerCase()}
        </h2>
      </div>

      <FilterRow filter={filter} onChange={setFilter} vendorOptions={vendorOptions} />

      <ul className="mt-3 divide-y divide-border rounded-2xl bg-card ring-1 ring-border">
        {filtered.map((t) => (
          <Row
            key={t.id}
            transaction={t}
            kind={category.kind}
            isInflow={isInflow}
            now={now}
            onEdit={() => setEditing(t)}
            onDelete={() => startDelete(t)}
          />
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            {transactions.length === 0
              ? "No transactions in this range."
              : "No transactions match the filter."}
          </li>
        )}
      </ul>

      <EditDialog
        editing={editing}
        onClose={() => setEditing(null)}
        categories={categories}
        allTransactions={allTransactions}
      />

      <UndoToast pending={pending} onUndo={undoDelete} />
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
    <div className="grid grid-cols-1 gap-2 rounded-2xl bg-card p-3 ring-1 ring-border sm:grid-cols-[1fr_140px_140px_140px]">
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
      <input
        type="date"
        value={filter.dateFrom ?? ""}
        onChange={(e) => onChange({ ...filter, dateFrom: e.target.value })}
        aria-label="From date"
        className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
      <input
        type="date"
        value={filter.dateTo ?? ""}
        onChange={(e) => onChange({ ...filter, dateTo: e.target.value })}
        aria-label="To date"
        className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
      />
    </div>
  );
}

function Row({
  transaction: t,
  kind,
  isInflow,
  now,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  kind: Category["kind"];
  isInflow: boolean;
  now: Date;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate">
            <span className="font-medium">{t.vendor ?? "—"}</span>
            <span className="ml-2 text-xs text-muted-foreground">{dayLabel(t.date, now)}</span>
          </p>
          <span
            className={cn(
              "shrink-0 tabular-nums",
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
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function UndoToast({
  pending,
  onUndo,
}: {
  pending: PendingDelete | null;
  onUndo: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-8 left-8 z-30 flex items-center gap-3 rounded-lg bg-card px-4 py-3 text-sm shadow-xl ring-1 ring-border transition-opacity",
        !pending && "pointer-events-none opacity-0",
      )}
    >
      {pending && (
        <>
          <span>
            Deleted <strong>{pending.transaction.vendor ?? "transaction"}</strong>
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
          >
            <Undo2 className="size-3.5" aria-hidden />
            Undo
          </button>
        </>
      )}
    </div>
  );
}
