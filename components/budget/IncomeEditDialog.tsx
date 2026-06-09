"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createIncomeSourceAction,
  endIncomeSourceAction,
  updateIncomeBaselineAction,
} from "@/app/actions/income";
import {
  INCOME_ACTION_INITIAL,
  type IncomeActionState,
} from "@/app/actions/income-state";
import { useNotify } from "@/components/notify";
import { fmt, monthLabel, nextMonth } from "@/lib/budget";
import { cn } from "@/lib/utils";

export type IncomeSourceRow = {
  id: string;
  name: string;
  emoji: string;
  /** Resolved monthly baseline for the current month, in dollars. */
  currentMonthly: number;
  /**
   * Monthly baseline that takes effect next month, only when it differs from
   * `currentMonthly` — surfaces a "your edit was scheduled" signal in the
   * modal so a save with `applyThisMonth=false` (default) is visible.
   */
  nextMonthly: number | null;
  /**
   * Inclusive last month the source is active. Present when the user has
   * already clicked End source. The row stays in the modal so the action is
   * visible, but Save/End controls are disabled.
   */
  activeUntil?: string;
};

export function IncomeEditDialog({
  sources,
  currentMonth,
  triggerClassName,
  triggerLabel = "Edit income",
}: {
  sources: IncomeSourceRow[];
  /** Current month key, e.g. "2026-06". Used to label the apply-toggle. */
  currentMonth: string;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const close = () => {
    setOpen(false);
    setShowAddForm(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerClassName,
        )}
        aria-label={triggerLabel}
      >
        <Pencil className="size-3.5" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Income sources
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Yearly values. New baselines apply from{" "}
            {monthLabel(nextMonth(currentMonth))} by default.
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            {sources.length === 0 && (
              <p className="rounded-md bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
                No income sources yet. Add one below.
              </p>
            )}
            {sources.map((src) => (
              <IncomeSourceForm
                key={src.id}
                source={src}
                currentMonth={currentMonth}
                onDone={close}
              />
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            {showAddForm ? (
              <AddSourceForm
                onDone={close}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary ring-1 ring-border hover:bg-muted"
              >
                <span className="text-base leading-none">+</span> Add another
                income source
              </button>
            )}
          </div>

          <div className="mt-5 flex justify-end">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Done
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Detects the post-action success transition: emits a success toast and
 * invokes `onDone` once when the `ok` counter increments. The message is
 * computed lazily (only on success), so a closure over fast-changing form
 * state — yearly input, apply-this-month checkbox — is fine. On failure the
 * dialog stays open (so the inline error is visible) and no toast fires:
 * the error is co-located with the form, not announced separately.
 */
function useSuccessEffect(
  state: IncomeActionState,
  computeMessage: () => string,
  onDone: () => void,
) {
  const notify = useNotify();
  const lastSeen = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastSeen.current && !state.error) {
      lastSeen.current = state.ok;
      notify.success(computeMessage());
      onDone();
    }
  }, [state, onDone, notify, computeMessage]);
}

function IncomeSourceForm({
  source,
  currentMonth,
  onDone,
}: {
  source: IncomeSourceRow;
  currentMonth: string;
  onDone: () => void;
}) {
  const initialYearly = source.currentMonthly * 12;
  const [yearlyInput, setYearlyInput] = useState(initialYearly.toString());
  const [applyThisMonth, setApplyThisMonth] = useState(false);
  const isEnded = source.activeUntil !== undefined;

  const [updateState, updateAction] = useActionState(
    updateIncomeBaselineAction,
    INCOME_ACTION_INITIAL,
  );
  const [endState, endAction] = useActionState(
    endIncomeSourceAction,
    INCOME_ACTION_INITIAL,
  );

  // Messages are computed lazily inside useSuccessEffect's success branch,
  // so the closure picks up the *latest* applyThisMonth / currentMonth at
  // commit time without any per-render bookkeeping.
  useSuccessEffect(
    updateState,
    () =>
      `Baseline updated · effective ${monthLabel(
        applyThisMonth ? currentMonth : nextMonth(currentMonth),
      )}`,
    onDone,
  );
  useSuccessEffect(
    endState,
    () => `${source.name} ends after ${monthLabel(currentMonth)}`,
    onDone,
  );

  const error = updateState.error ?? endState.error;

  // Disable Save when there's nothing to persist: the yearly value matches
  // the current baseline AND the apply-toggle isn't asking us to write a
  // (no-op) current-month row over a next-month-effective row.
  const parsedYearly = Number(yearlyInput);
  const yearlyUnchanged =
    Number.isFinite(parsedYearly) && parsedYearly === initialYearly;
  const saveDisabled = isEnded || (yearlyUnchanged && !applyThisMonth);

  return (
    <div
      className={cn(
        "rounded-xl bg-background p-3 ring-1 ring-border",
        isEnded && "opacity-75",
      )}
    >
      <form action={updateAction} className="space-y-2">
        <input type="hidden" name="categoryId" value={source.id} />
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-muted text-lg">
            {source.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{source.name}</p>
            <p className="text-[11px] text-muted-foreground">
              Current: {fmt(initialYearly)}/yr · {fmt(source.currentMonthly)}/mo
            </p>
            {source.nextMonthly !== null && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Scheduled {monthLabel(nextMonth(currentMonth))}:{" "}
                {fmt(source.nextMonthly * 12)}/yr · {fmt(source.nextMonthly)}/mo
              </p>
            )}
            {isEnded && (
              <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                Ends after {monthLabel(source.activeUntil!)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor={`yearly-${source.id}`}>
            Yearly
          </label>
          <input
            id={`yearly-${source.id}`}
            name="yearly"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={yearlyInput}
            onChange={(e) => setYearlyInput(e.target.value)}
            disabled={isEnded}
            className="flex-1 rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <label
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            isEnded && "cursor-not-allowed opacity-50",
          )}
        >
          <input
            type="checkbox"
            name="applyThisMonth"
            checked={applyThisMonth}
            onChange={(e) => setApplyThisMonth(e.target.checked)}
            disabled={isEnded}
            className="size-3.5 accent-foreground"
          />
          Apply this month ({monthLabel(currentMonth)})
        </label>
        <div className="flex items-center justify-between gap-2 pt-1">
          <SubmitButton
            label="Save baseline"
            pendingLabel="Saving…"
            disabled={saveDisabled}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </form>
      {!isEnded && (
        <form action={endAction} className="mt-2 flex justify-end">
          <input type="hidden" name="categoryId" value={source.id} />
          <SubmitButton
            label="End source"
            pendingLabel="Ending…"
            className="rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
          />
        </form>
      )}
    </div>
  );
}

function AddSourceForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState(
    createIncomeSourceAction,
    INCOME_ACTION_INITIAL,
  );
  useSuccessEffect(state, () => "Income source added", onDone);

  return (
    <form
      action={formAction}
      className="space-y-2 rounded-xl bg-background p-3 ring-1 ring-border"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        New income source
      </p>
      <div className="grid grid-cols-[64px_1fr] gap-2">
        <input
          name="emoji"
          defaultValue="💰"
          maxLength={4}
          aria-label="Emoji"
          className="rounded-md bg-background px-2 py-1.5 text-center text-lg ring-1 ring-border outline-none focus:ring-ring"
        />
        <input
          name="name"
          placeholder="Side gig"
          required
          className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </div>
      <input
        name="yearly"
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        placeholder="$0/yr"
        required
        className="w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
      />
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <SubmitButton
          label="Add source"
          pendingLabel="Adding…"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60"
        />
      </div>
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  className,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
