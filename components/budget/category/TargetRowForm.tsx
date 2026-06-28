"use client";

import { useActionState, useState } from "react";

import {
  deleteCategoryTargetAction,
  upsertCategoryTargetAction,
} from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { monthLabel, targetLabel } from "@/lib/budget";
import { monthlyToYearly, yearlyToMonthly } from "@/lib/income";
import type { CategoryKind, CategoryTarget } from "@/types/budget";

/**
 * One editable row in the target-history disclosure: a save form for the
 * target amount plus a separate remove form. `canDelete` is false for the
 * earliest row (removing it would leave months below it resolving to 0).
 *
 * Income rows are shown and edited as gross yearly (income_model); storage
 * stays monthly, so the converted value rides a hidden `monthly` field while
 * the visible field shows yearly. Expense/savings rows edit monthly directly.
 */
export function TargetRowForm({
  row,
  canDelete,
  kind,
}: {
  row: CategoryTarget;
  canDelete: boolean;
  kind: CategoryKind;
}) {
  const isIncome = kind === "income";
  const displayValue = isIncome ? monthlyToYearly(row.monthly) : row.monthly;
  const [value, setValue] = useState(displayValue.toString());

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
    () => `${targetLabel(kind)} updated for ${monthLabel(row.effectiveFrom)}`,
  );
  useActionSuccessToast(
    deleteState,
    () => `${targetLabel(kind)} row removed (${monthLabel(row.effectiveFrom)})`,
  );

  const error = updateState.error ?? deleteState.error;
  const parsed = Number(value);
  const unchanged = Number.isFinite(parsed) && parsed === displayValue;

  return (
    <div className="rounded-md bg-background p-2 ring-1 ring-border">
      <form action={updateAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="categoryId" value={row.categoryId} />
        <input type="hidden" name="effectiveFrom" value={row.effectiveFrom} />
        <span className="min-w-[110px] text-xs font-medium">
          {monthLabel(row.effectiveFrom)}
        </span>
        {isIncome && (
          <input
            type="hidden"
            name="monthly"
            value={Number.isFinite(parsed) ? yearlyToMonthly(parsed) : ""}
          />
        )}
        <AmountInput
          name={isIncome ? undefined : "monthly"}
          precision={isIncome ? "whole" : "cents"}
          value={value}
          onChange={setValue}
          allowZero
          ariaLabel={`${isIncome ? "Yearly baseline" : "Monthly target"} effective ${row.effectiveFrom}`}
          className="w-28 px-2 py-1"
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
