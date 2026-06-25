"use client";

import { useActionState, useState } from "react";

import { updateIncomeBaselineAction } from "@/app/actions/income";
import { INCOME_ACTION_INITIAL } from "@/app/actions/income-state";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { monthLabel, nextMonth } from "@/lib/budget";
import { monthlyToYearly } from "@/lib/income";
import type { Category } from "@/types/budget";

/**
 * Inline editor mounted beneath an `IncomeSourceCard` when the user clicks
 * the pencil. Owns yearly + apply-this-month state, fires
 * `updateIncomeBaselineAction`, and emits a success toast through the
 * shared `useActionSuccessToast` hook. The Save baseline button is
 * conditionally rendered (not just disabled) so a clean form doesn't show
 * an inert primary CTA (story 7 of #39).
 *
 * Dirty rule: a write is meaningful either when the yearly value diverges
 * from the resolved current monthly or when the user explicitly checks
 * "apply this month" (writing a current-month-effective row over the
 * default next-month one).
 */
export function IncomeSourceEditor({
  source,
  currentMonthly,
  currentMonth,
  onClose,
}: {
  source: Category;
  currentMonthly: number;
  currentMonth: string;
  onClose: () => void;
}) {
  // `monthlyToYearly` rounds to cents on read so the input doesn't display
  // float-drift like 99999.99999999999 after a $100k yearly was stored as
  // 8333.333…/mo. The same rounded value drives the dirty comparison below,
  // so a reopened clean form stays clean.
  const initialYearly = monthlyToYearly(currentMonthly);
  const [yearlyInput, setYearlyInput] = useState(initialYearly.toString());
  const [applyThisMonth, setApplyThisMonth] = useState(false);

  const [state, formAction] = useActionState(
    updateIncomeBaselineAction,
    INCOME_ACTION_INITIAL,
  );

  useActionSuccessToast(
    state,
    () =>
      `Baseline updated · effective ${monthLabel(
        applyThisMonth ? currentMonth : nextMonth(currentMonth),
      )}`,
    onClose,
  );

  const parsedYearly = Number(yearlyInput);
  const yearlyUnchanged =
    Number.isFinite(parsedYearly) && parsedYearly === initialYearly;
  const dirty = !yearlyUnchanged || applyThisMonth;

  const yearlyId = `income-yearly-${source.id}`;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Save baseline is hidden when the form is clean, but the form
        // itself still has `action={formAction}` — pressing Enter inside
        // the yearly input would otherwise submit a no-op write and toast
        // a misleading "Baseline updated". Short-circuit at the submit
        // boundary so Enter on a clean form is silent.
        if (!dirty) e.preventDefault();
      }}
      className="mt-3 space-y-2 border-t border-border pt-3"
    >
      <input type="hidden" name="categoryId" value={source.id} />
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor={yearlyId}>
          Yearly
        </label>
        <input
          id={yearlyId}
          name="yearly"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={yearlyInput}
          onChange={(e) => setYearlyInput(e.target.value)}
          autoFocus
          className="flex-1 rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="applyThisMonth"
          checked={applyThisMonth}
          onChange={(e) => setApplyThisMonth(e.target.checked)}
          className="size-3.5 accent-foreground"
        />
        Apply this month ({monthLabel(currentMonth)})
      </label>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
        {dirty && (
          <FormSubmitButton
            label="Save baseline"
            pendingLabel="Saving…"
            variant="compact"
          />
        )}
      </div>
    </form>
  );
}
