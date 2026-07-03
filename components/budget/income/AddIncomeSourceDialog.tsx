"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { createIncomeSourceAction } from "@/app/actions/income";
import { INCOME_ACTION_INITIAL } from "@/app/actions/income-state";
import { AddIncomeSourceSubmitButton } from "@/components/budget/income/AddIncomeSourceSubmitButton";
import { CadenceField } from "@/components/budget/income/CadenceField";
import {
  type AmountUnit,
  RecurringAmountField,
} from "@/components/budget/income/RecurringAmountField";
import { CategoryIconPicker } from "@/components/budget/category/CategoryIconPicker";
import { useNotify } from "@/hooks/useNotify";
import { paycheckFromYearly } from "@/lib/income";
import { cn } from "@/lib/utils";
import type { IncomeFrequency, PayCadence } from "@/types/budget";

const FREQUENCY_OPTIONS: ReadonlyArray<{
  value: IncomeFrequency;
  title: string;
  description: string;
}> = [
  {
    value: "recurring",
    title: "Recurring",
    description: "Paid on a schedule — salary, a steady gig.",
  },
  {
    value: "one-time",
    title: "One-time",
    description: "Sporadic — annual bonus, RSU vest, side gig.",
  },
];

/**
 * Two-step create-source dialog (#46), reused by the floating ⊕ menu and the
 * on-page "+ Add income source" button — one create path regardless of entry
 * point (story 14). Step 1 picks the frequency; step 2 branches:
 *
 *  - **recurring** — cadence segmented control + per-paycheck amount (the
 *    user's natural unit, story 3) + name + emoji. A live `≈ $X/yr` preview
 *    annualizes the paycheck so the yearly figure stays legible.
 *  - **one-time** — just name + emoji (no baseline applies, story 5).
 *
 * The step-2 `<form>` posts to `createIncomeSourceAction`; step 1 is plain
 * client state, surfaced into the form as a hidden `frequency` input. ESC
 * closes from either step (base-ui `onOpenChange`); Back clears the chosen
 * frequency and returns to step 1.
 */
export function AddIncomeSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [state, formAction] = useActionState(
    createIncomeSourceAction,
    INCOME_ACTION_INITIAL,
  );
  const notify = useNotify();
  const lastOk = useRef(state.ok);

  const [step, setStep] = useState<1 | 2>(1);
  const [frequency, setFrequency] = useState<IncomeFrequency | null>(null);
  const [emoji, setEmoji] = useState("💰");
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<PayCadence>("bi-weekly");
  // Amount entry defaults to yearly with a per-paycheck toggle (RecurringAmountField).
  // `amountValue` is in `amountUnit`'s denomination; we convert to the
  // per-paycheck figure the create action expects at submit.
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("yearly");
  const [amountValue, setAmountValue] = useState("");
  const [firstPaycheckDate, setFirstPaycheckDate] = useState("");

  // Clears every field back to a fresh step-1 state. Used both when the dialog
  // closes and by the step-2 Back link, so re-picking a frequency never carries
  // stale entries from the other branch (e.g. a typed amount surviving a switch
  // to one-time).
  function resetForm() {
    setStep(1);
    setFrequency(null);
    setEmoji("💰");
    setName("");
    setCadence("bi-weekly");
    setAmountUnit("yearly");
    setAmountValue("");
    setFirstPaycheckDate("");
  }

  // Reset when the dialog transitions open → closed, so the next opening starts
  // fresh. Render-time prev comparison (React 19's set-state-in-effect rule
  // forbids the more obvious useEffect form).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) resetForm();
  }

  useEffect(() => {
    if (!open) lastOk.current = state.ok; // resync when dialog reopens
    else if (state.ok > lastOk.current && !state.error) {
      lastOk.current = state.ok;
      notify.success("Income source added");
      onOpenChange(false);
    }
  }, [open, state, onOpenChange, notify]);

  const onStep2 = step === 2;
  const isRecurring = frequency === "recurring";

  // The create action stores monthly = monthlyFromCadence(perPaycheck, cadence),
  // so submit the per-paycheck figure regardless of the entry unit.
  const amountNum = Number(amountValue);
  const perPaycheckValue =
    amountValue === "" || !Number.isFinite(amountNum)
      ? ""
      : amountUnit === "per-paycheck"
        ? amountValue
        : paycheckFromYearly(amountNum, cadence).toFixed(2);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Add income source
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            {onStep2
              ? isRecurring
                ? "Enter your pay — yearly, or switch to per-paycheck."
                : "Log this source; record each receipt as it lands."
              : "How does this income arrive?"}
          </Dialog.Description>

          {!onStep2 ? (
            <div className="mt-4 space-y-3">
              <fieldset className="space-y-2">
                <legend className="sr-only">Income frequency</legend>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer flex-col gap-0.5 rounded-xl p-3 ring-1 transition-colors",
                      frequency === opt.value
                        ? "bg-muted ring-primary"
                        : "bg-background ring-border hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="frequency-choice"
                        value={opt.value}
                        checked={frequency === opt.value}
                        onChange={() => setFrequency(opt.value)}
                        className="size-3.5 accent-primary"
                      />
                      <span className="text-sm font-medium">{opt.title}</span>
                    </span>
                    <span className="pl-6 text-xs text-muted-foreground">
                      {opt.description}
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Dialog.Close className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                  Cancel
                </Dialog.Close>
                <button
                  type="button"
                  disabled={frequency === null}
                  onClick={() => setStep(2)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="frequency" value={frequency ?? ""} />
              <input type="hidden" name="emoji" value={emoji} />

              {isRecurring && (
                <>
                  <CadenceField value={cadence} onChange={setCadence} />
                  <input
                    type="hidden"
                    name="amountPerPaycheck"
                    value={perPaycheckValue}
                  />
                  <RecurringAmountField
                    unit={amountUnit}
                    value={amountValue}
                    cadence={cadence}
                    onChange={({ unit, value }) => {
                      setAmountUnit(unit);
                      setAmountValue(value);
                    }}
                    autoFocus
                  />
                  {cadence !== "semi-monthly" && (
                    <label className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-muted-foreground">
                        First paycheck
                      </span>
                      <input
                        name="firstPaycheckDate"
                        type="date"
                        value={firstPaycheckDate}
                        onChange={(e) => setFirstPaycheckDate(e.target.value)}
                        className="flex-1 rounded-md bg-background px-2 py-1.5 text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
                      />
                    </label>
                  )}
                </>
              )}

              <div className="grid grid-cols-[64px_1fr] gap-2">
                <CategoryIconPicker
                  value={emoji}
                  onChange={setEmoji}
                  nameHint={name}
                  ariaLabel="Choose income source icon"
                />
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isRecurring ? "Side gig" : "RSU vests"}
                  required
                  autoFocus={!isRecurring}
                  className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
                />
              </div>

              {state.error && (
                <p role="alert" className="text-xs text-destructive">
                  {state.error}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <Dialog.Close className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                    Cancel
                  </Dialog.Close>
                  <AddIncomeSourceSubmitButton />
                </div>
              </div>
            </form>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
