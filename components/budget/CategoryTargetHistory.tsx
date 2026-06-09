"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  deleteCategoryTargetAction,
  upsertCategoryTargetAction,
} from "@/app/actions/categories";
import {
  CATEGORY_ACTION_INITIAL,
  type CategoryActionState,
} from "@/app/actions/category-state";
import { useNotify } from "@/components/notify";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { monthLabel, targetLabel } from "@/lib/budget";
import type { CategoryKind, CategoryTarget } from "@/types/budget";

/**
 * Generic "fire-and-toast" effect re-used across this sub-panel and the
 * category edit panel. Message is computed lazily so closures over fast-
 * changing form state (the per-row monthly input) are safe.
 */
function useToastOnSuccess(
  state: CategoryActionState,
  computeMessage: () => string,
  onSuccess?: () => void,
) {
  const notify = useNotify();
  const lastSeen = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastSeen.current && !state.error) {
      lastSeen.current = state.ok;
      notify.success(computeMessage());
      onSuccess?.();
    }
  }, [state, onSuccess, notify, computeMessage]);
}

/**
 * Collapsed "View {target}-history" disclosure inside the category edit panel.
 * Sorts target rows newest-first; each row is editable in place, and an
 * "+ Insert target row" footer adds a new row at an arbitrary `effectiveFrom`.
 * The earliest row is non-removable — deleting it would leave months below
 * the surviving floor resolving to 0 (the server action enforces the same
 * rule).
 */
export function CategoryTargetHistory({
  categoryId,
  targets,
  kind,
}: {
  categoryId: string;
  /** Pre-sorted newest-first by the parent. */
  targets: CategoryTarget[];
  kind: CategoryKind;
}) {
  const [showAddRow, setShowAddRow] = useState(false);
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        View {targetLabel(kind).toLowerCase()} history
        <span className="ml-1 font-normal normal-case text-muted-foreground">
          ({targets.length} row{targets.length === 1 ? "" : "s"})
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        {targets.map((row, idx) => (
          <TargetRowForm
            key={`${row.categoryId}:${row.effectiveFrom}`}
            row={row}
            // `targets` is newest-first; last item is earliest. Removing the
            // earliest would leave months below it with a 0 target.
            canDelete={targets.length > 1 && idx !== targets.length - 1}
          />
        ))}
        {showAddRow ? (
          <NewTargetRowForm
            categoryId={categoryId}
            onDone={() => setShowAddRow(false)}
            onCancel={() => setShowAddRow(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAddRow(true)}
            className="w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            + Insert target row
          </button>
        )}
      </div>
    </details>
  );
}

function TargetRowForm({
  row,
  canDelete,
}: {
  row: CategoryTarget;
  canDelete: boolean;
}) {
  const [monthly, setMonthly] = useState(row.monthly.toString());

  const [updateState, updateAction] = useActionState(
    upsertCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  useToastOnSuccess(
    updateState,
    () => `Target updated for ${monthLabel(row.effectiveFrom)}`,
  );
  useToastOnSuccess(
    deleteState,
    () => `Target row removed (${monthLabel(row.effectiveFrom)})`,
  );

  const error = updateState.error ?? deleteState.error;
  const parsed = Number(monthly);
  const unchanged = Number.isFinite(parsed) && parsed === row.monthly;

  return (
    <div className="rounded-md bg-background p-2 ring-1 ring-border">
      <form action={updateAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="categoryId" value={row.categoryId} />
        <input type="hidden" name="effectiveFrom" value={row.effectiveFrom} />
        <span className="min-w-[110px] text-xs font-medium">
          {monthLabel(row.effectiveFrom)}
        </span>
        <input
          name="monthly"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          required
          aria-label={`Monthly target effective ${row.effectiveFrom}`}
          className="w-28 rounded-md bg-background px-2 py-1 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
        />
        <FormSubmitButton
          label="Save"
          pendingLabel="…"
          disabled={unchanged}
          variant="compact"
          className="px-2 py-1"
        />
      </form>
      <form action={deleteAction} className="mt-1 flex justify-end">
        <input type="hidden" name="categoryId" value={row.categoryId} />
        <input type="hidden" name="effectiveFrom" value={row.effectiveFrom} />
        <FormSubmitButton
          label="Remove"
          pendingLabel="…"
          disabled={!canDelete}
          variant="ghost-destructive"
        />
      </form>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NewTargetRowForm({
  categoryId,
  onDone,
  onCancel,
}: {
  categoryId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState(
    upsertCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  useToastOnSuccess(state, () => "Target row added", onDone);

  return (
    <form
      action={action}
      className="space-y-2 rounded-md bg-background p-2 ring-1 ring-border"
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="effectiveFrom"
          type="month"
          required
          aria-label="Effective from"
          className="rounded-md bg-background px-2 py-1 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
        <input
          name="monthly"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="$0/mo"
          required
          aria-label="Monthly target"
          className="w-28 rounded-md bg-background px-2 py-1 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <FormSubmitButton
          label="Add row"
          pendingLabel="Adding…"
          variant="compact"
          className="px-2 py-1"
        />
      </div>
    </form>
  );
}
