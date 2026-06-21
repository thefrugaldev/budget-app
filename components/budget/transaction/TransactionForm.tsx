"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  createTransactionAction,
  updateTransactionAction,
} from "@/app/actions/transactions";
import { TX_ACTION_INITIAL } from "@/app/actions/transactions-state";
import { CategoryPicker } from "@/components/budget/category/CategoryPicker";
import { TransactionFields } from "@/components/budget/transaction/TransactionFields";
import { TransactionSubmitButton } from "@/components/budget/transaction/TransactionSubmitButton";
import { useNotify } from "@/hooks/useNotify";
import {
  mostRecentTransactionInCategory,
  vendorSuggestionsForCategory,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/budget";

export type TransactionFormProps = {
  categories: Category[];
  transactions: Transaction[];
  /**
   * When present, the form opens in edit mode pre-loaded with this row.
   * `id` and `originalCategoryId` are submitted as hidden fields so the
   * server action can update the right document and revalidate the previous
   * detail page when the user re-categorizes (story 45).
   */
  editing?: Transaction;
  /** Add-mode only: opens with this category preselected (story 30). */
  initialCategoryId?: string;
  /** Called after a successful save — used by the dialog wrapper to close itself. */
  onSuccess?: () => void;
  /** Submit button label override; defaults to "Add transaction" / "Save changes". */
  submitLabel?: string;
  className?: string;
  /**
   * Compact layout for inline placement on the category detail page (issue #15,
   * chunk 1): hides the category picker (category is implicit), lays fields out
   * as a single row at md+ widths, and collapses Note behind a "+ Note"
   * expander. Mobile stays vertical but tightened.
   */
  compact?: boolean;
};

export function TransactionForm({
  categories,
  transactions,
  editing,
  initialCategoryId,
  onSuccess,
  submitLabel,
  className,
  compact = false,
}: TransactionFormProps) {
  const isEdit = editing !== undefined;
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const [categoryId, setCategoryId] = useState<string | undefined>(
    editing?.categoryId ?? initialCategoryId,
  );
  // Bumps after every successful save — used as part of the Fields component's
  // `key` so the inputs remount with fresh defaults instead of carrying stale
  // text from the previous submission.
  const [resetCount, setResetCount] = useState(0);

  const selected = categoryId ? categoryMap.get(categoryId) : undefined;
  // Edit mode always prefills from the editing row, even after the user
  // re-categorizes (story 45) — we don't want to clobber typed values with
  // "most recent in the new category".
  const prefill = useMemo(() => {
    if (editing) return editing;
    return categoryId
      ? mostRecentTransactionInCategory(transactions, categoryId)
      : undefined;
  }, [editing, categoryId, transactions]);
  const vendorOptions = useMemo(
    () => (categoryId ? vendorSuggestionsForCategory(transactions, categoryId) : []),
    [categoryId, transactions],
  );

  const [state, formAction] = useActionState(
    isEdit ? updateTransactionAction : createTransactionAction,
    TX_ACTION_INITIAL,
  );
  const notify = useNotify();
  const lastOk = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastOk.current && !state.error) {
      lastOk.current = state.ok;
      notify.success(isEdit ? "Transaction updated" : "Transaction added");
      onSuccess?.();
      setResetCount((c) => c + 1);
    }
  }, [state, onSuccess, notify, isEdit]);

  const defaultSubmitLabel = isEdit
    ? "Save changes"
    : compact
      ? "Add"
      : "Add transaction";
  // In edit mode the field key drops the category dep so re-categorization
  // doesn't remount the inputs (and discard the user's typed values). In add
  // mode the category change is the signal to re-pre-fill from history.
  const fieldsKey = isEdit
    ? `edit:${editing.id}:${resetCount}`
    : `${categoryId ?? "_none_"}:${resetCount}`;

  const submitButton = (
    <TransactionSubmitButton
      disabled={!categoryId}
      label={submitLabel ?? defaultSubmitLabel}
      pendingLabel={isEdit ? "Saving…" : "Adding…"}
    />
  );

  return (
    <form action={formAction} className={cn(compact ? "space-y-2" : "space-y-3", className)}>
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />
      {isEdit && (
        <>
          <input type="hidden" name="id" value={editing.id} />
          <input
            type="hidden"
            name="originalCategoryId"
            value={editing.categoryId}
          />
        </>
      )}

      {!compact && (
        <CategoryPicker
          categories={categories}
          selectedId={categoryId}
          onChange={setCategoryId}
        />
      )}

      <TransactionFields
        key={fieldsKey}
        kind={selected?.kind}
        prefill={prefill}
        vendorOptions={vendorOptions}
        useDateFromPrefill={isEdit}
        compact={compact}
        submitButton={compact ? submitButton : null}
      />

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}

      {!compact && (
        <div className="flex justify-end pt-1">{submitButton}</div>
      )}
    </form>
  );
}
