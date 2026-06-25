"use client";

import { useActionState, useState } from "react";

import {
  deleteCategoryTargetAction,
  upsertCategoryTargetAction,
} from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { monthLabel } from "@/lib/budget";
import type { CategoryTarget } from "@/types/budget";

/**
 * One editable row in the target-history disclosure: a save form for the
 * monthly amount plus a separate remove form. `canDelete` is false for the
 * earliest row (removing it would leave months below it resolving to 0).
 */
export function TargetRowForm({
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
  useActionSuccessToast(
    updateState,
    () => `Target updated for ${monthLabel(row.effectiveFrom)}`,
  );
  useActionSuccessToast(
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
