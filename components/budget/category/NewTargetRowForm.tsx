"use client";

import { useActionState, useState } from "react";

import { upsertCategoryTargetAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { MonthPickerField } from "@/components/ui/MonthPickerField";
import { useToastOnSuccess } from "@/hooks/useToastOnSuccess";

/**
 * Footer form in the target-history disclosure for inserting a new target row
 * at an arbitrary `effectiveFrom`. Closes itself on success via `onDone`.
 */
export function NewTargetRowForm({
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
  const [effectiveFrom, setEffectiveFrom] = useState("");

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
