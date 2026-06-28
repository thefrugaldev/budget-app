"use client";

import { useActionState, useState } from "react";

import { upsertCategoryTargetAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { MonthPickerField } from "@/components/ui/MonthPickerField";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { yearlyToMonthly } from "@/lib/income";
import type { CategoryKind } from "@/types/budget";

/**
 * Footer form in the target-history disclosure for inserting a new target row
 * at an arbitrary `effectiveFrom`. Closes itself on success via `onDone`.
 *
 * Income rows are entered as gross yearly (income_model); the converted
 * monthly value rides a hidden field so storage stays monthly.
 */
export function NewTargetRowForm({
  categoryId,
  kind,
  onDone,
  onCancel,
}: {
  categoryId: string;
  kind: CategoryKind;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState(
    upsertCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  useActionSuccessToast(state, () => "Target row added", onDone);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const isIncome = kind === "income";
  const [amount, setAmount] = useState("");
  const parsedAmount = Number(amount);

  return (
    <form
      action={action}
      className="space-y-2 rounded-md bg-background p-2 ring-1 ring-border"
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <MonthPickerField
            value={effectiveFrom}
            onChange={setEffectiveFrom}
            name="effectiveFrom"
            required
            ariaLabel="Effective from"
          />
        </div>
        {isIncome && (
          <input
            type="hidden"
            name="monthly"
            value={Number.isFinite(parsedAmount) ? yearlyToMonthly(parsedAmount) : ""}
          />
        )}
        <AmountInput
          name={isIncome ? undefined : "monthly"}
          precision={isIncome ? "whole" : "cents"}
          value={amount}
          onChange={setAmount}
          allowZero
          placeholder={isIncome ? "$0/yr" : "$0/mo"}
          ariaLabel={isIncome ? "Yearly baseline" : "Monthly target"}
          className="w-28 px-2 py-1"
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
