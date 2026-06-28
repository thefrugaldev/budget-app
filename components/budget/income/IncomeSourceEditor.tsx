"use client";

import { useActionState, useRef, useState } from "react";

import { updateIncomeSourceAction } from "@/app/actions/income";
import { INCOME_ACTION_INITIAL } from "@/app/actions/income-state";
import { CadenceField } from "@/components/budget/income/CadenceField";
import {
  type AmountUnit,
  RecurringAmountField,
} from "@/components/budget/income/RecurringAmountField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { monthLabel, nextMonth } from "@/lib/budget";
import { monthlyToYearly, yearlyFromPaycheck } from "@/lib/income";
import { cn } from "@/lib/utils";
import type { Category, IncomeFrequency, PayCadence } from "@/types/budget";

const FREQUENCIES: ReadonlyArray<{ value: IncomeFrequency; label: string }> = [
  { value: "recurring", label: "Recurring" },
  { value: "one-time", label: "One-time" },
];

// Default cadence offered when a migrated legacy source has none yet — matches
// the Add form's default, so "set pay cadence" lands on the most common choice.
const DEFAULT_CADENCE: PayCadence = "bi-weekly";

/**
 * Inline editor mounted beneath an `IncomeSourceCard` when the user clicks the
 * pencil. Kind-aware (#46 chunk 7): a frequency toggle drives which fields show,
 * so one editor serves both kinds without forking (story 11).
 *
 *  - **Recurring** — pay-cadence picker + yearly baseline + apply-this-month.
 *    Editing a migrated legacy source (no cadence yet) is the "set pay cadence"
 *    path; saving assigns the chosen cadence. The yearly figure stays the entry
 *    unit (it's shown on the card alongside the lived per-paycheck amount), and
 *    a cadence-only change writes no baseline row.
 *  - **One-time** — the baseline section is omitted entirely; a one-time source
 *    is measured against its receipts, not a baseline (story 12).
 *
 * Switching recurring → one-time discards the baseline, so it routes through a
 * `ConfirmDialog` before submitting. The Save button is conditionally rendered
 * (not just disabled) so a clean form doesn't show an inert primary CTA.
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
  const originalFrequency: IncomeFrequency = source.incomeFrequency ?? "recurring";

  const [frequency, setFrequency] = useState<IncomeFrequency>(originalFrequency);
  const [cadence, setCadence] = useState<PayCadence>(
    source.payCadence ?? DEFAULT_CADENCE,
  );
  // Baseline is stored monthly but entered as yearly (default) or per-paycheck
  // via the unit toggle. `amountValue` is in `amountUnit`'s denomination; the
  // gross yearly (whole dollars) is derived for the action + dirty check.
  // Rounding to whole keeps a mere unit toggle from registering as a change.
  const initialYearly = Math.round(monthlyToYearly(currentMonthly));
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("yearly");
  const [amountValue, setAmountValue] = useState(
    initialYearly > 0 ? String(initialYearly) : "",
  );
  const [firstPaycheckInput, setFirstPaycheckInput] = useState(
    source.firstPaycheckDate ?? "",
  );
  const [applyThisMonth, setApplyThisMonth] = useState(false);

  const [state, formAction] = useActionState(
    updateIncomeSourceAction,
    INCOME_ACTION_INITIAL,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const amountNum = Number(amountValue);
  const currentYearly =
    amountValue === "" || !Number.isFinite(amountNum) || amountNum <= 0
      ? 0
      : Math.round(
          amountUnit === "yearly"
            ? amountNum
            : yearlyFromPaycheck(amountNum, cadence),
        );
  const yearlyChanged = currentYearly !== initialYearly;
  const cadenceChanged = cadence !== source.payCadence;
  const firstPaycheckChanged =
    (firstPaycheckInput || undefined) !== source.firstPaycheckDate;
  const frequencyChanged = frequency !== originalFrequency;

  const dirty =
    frequency === "one-time"
      ? frequencyChanged
      : frequencyChanged ||
        cadenceChanged ||
        yearlyChanged ||
        firstPaycheckChanged ||
        applyThisMonth;

  // Recurring → one-time throws the baseline away, so gate it behind a confirm.
  const needsDiscardConfirm =
    originalFrequency === "recurring" && frequency === "one-time";

  const successMessage = (): string => {
    if (frequency === "one-time") return "Switched to one-time · baseline discarded";
    if (frequencyChanged) return "Switched to recurring · baseline set";
    if (yearlyChanged || applyThisMonth) {
      return `Baseline updated · effective ${monthLabel(
        applyThisMonth ? currentMonth : nextMonth(currentMonth),
      )}`;
    }
    return "Pay schedule updated";
  };

  useActionSuccessToast(state, successMessage, onClose);

  const yearlyId = `income-yearly-${source.id}`;
  const firstPaycheckId = `income-first-paycheck-${source.id}`;
  const isRecurring = frequency === "recurring";
  const cadenceUnset = !source.payCadence;

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(e) => {
          if (!dirty) {
            // Save is hidden when clean, but Enter inside a field would still
            // submit a no-op write and toast misleadingly — short-circuit it.
            e.preventDefault();
            return;
          }
          if (needsDiscardConfirm && !confirmedRef.current) {
            e.preventDefault();
            setConfirmOpen(true);
            return;
          }
          confirmedRef.current = false; // consume the confirmation
        }}
        className="mt-3 space-y-3 border-t border-border pt-3"
      >
        <input type="hidden" name="categoryId" value={source.id} />
        <input type="hidden" name="frequency" value={frequency} />

        <div
          role="radiogroup"
          aria-label="Income frequency"
          className="grid grid-cols-2 gap-1.5"
        >
          {FREQUENCIES.map((opt) => {
            const selected = opt.value === frequency;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setFrequency(opt.value)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background text-muted-foreground ring-border hover:bg-muted hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {isRecurring ? (
          <>
            <div className="space-y-1.5">
              <CadenceField value={cadence} onChange={setCadence} />
              {cadenceUnset && (
                <p className="text-xs text-muted-foreground">
                  Set a pay cadence to show your lived per-paycheck amount.
                </p>
              )}
            </div>
            {cadence !== "semi-monthly" && (
              <div className="flex items-center gap-2">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor={firstPaycheckId}
                >
                  First paycheck
                </label>
                <input
                  id={firstPaycheckId}
                  name="firstPaycheckDate"
                  type="date"
                  value={firstPaycheckInput}
                  onChange={(e) => setFirstPaycheckInput(e.target.value)}
                  className="flex-1 rounded-md bg-background px-2 py-1.5 text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
                />
              </div>
            )}
            <input
              type="hidden"
              name="yearly"
              value={currentYearly > 0 ? String(currentYearly) : ""}
            />
            <RecurringAmountField
              id={yearlyId}
              unit={amountUnit}
              value={amountValue}
              cadence={cadence}
              onChange={({ unit, value }) => {
                setAmountUnit(unit);
                setAmountValue(value);
              }}
              autoFocus
            />
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
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            One-time sources have no baseline — they&rsquo;re measured by the
            receipts you log against them.
          </p>
        )}

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
              label="Save"
              pendingLabel="Saving…"
              variant="compact"
            />
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Switch to one-time?"
        description="Switching to one-time will discard the monthly baseline. The source will be measured by its receipts instead."
        confirmLabel="Switch to one-time"
        tone="destructive"
        onConfirm={() => {
          confirmedRef.current = true;
          setConfirmOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
