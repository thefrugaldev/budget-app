"use client";

import { Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { updateIncomeBaselineAction } from "@/app/actions/income";
import {
  INCOME_ACTION_INITIAL,
  type IncomeActionState,
} from "@/app/actions/income-state";
import { useNotify } from "@/components/notify";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { fmt, monthLabel, nextMonth, resolveTargetForMonth } from "@/lib/budget";
import {
  buildIncomeSourceDisplayLabel,
  classifyIncomeSourceStatus,
  type IncomeSourceStatus,
} from "@/lib/income";
import { cn } from "@/lib/utils";
import type { Category, CategoryTarget } from "@/types/budget";

/**
 * Read-mode + inline editor card for an income source on `/income`
 * (chunks 4–5 of #39). Renders emoji + display label + an exception-only
 * status pill on a single row, with a one-sentence baseline summary
 * beneath. The Edit pencil expands an inline editor (yearly + apply-this-
 * month + Save baseline) that fires `updateIncomeBaselineAction`. Lifecycle
 * affordances (⋯ menu, leading Reopen on ended rows) land in chunk 6.
 *
 * Status pill is rendered only for exceptions — "Scheduled change" and
 * "Ended" — so a card with no pill reads as the default "ongoing" state.
 * Active was originally specced as its own pill but proved to be visual tax
 * on the common case (the default state doesn't earn screen space).
 *
 * Display rules per PRD:
 *  - "active": `$X/yr · $Y/mo`
 *  - "scheduled-change": `$X/yr · $Y/mo → $Z/yr starting <month>`
 *  - "ended": `Ended after <month> · last baseline $X/yr`
 *
 * Accessibility: each card is a labelled `<li>` whose `aria-label` is the
 * display label, plus the pill copy when one is shown — so screen readers
 * announce the exception status rather than depending on colour (story 18).
 */
export function IncomeSourceCard({
  source,
  allSources,
  targets,
  currentMonth,
}: {
  source: Category;
  allSources: Category[];
  targets: CategoryTarget[];
  currentMonth: string;
}) {
  const status = classifyIncomeSourceStatus(source, currentMonth, targets);
  const label = buildIncomeSourceDisplayLabel(source, allSources, status);
  const summary = baselineSummary(source, targets, currentMonth, status);
  const pillCopy = statusPillCopy(source, status);
  const currentMonthly = resolveTargetForMonth(
    source.id,
    currentMonth,
    targets,
  );

  const [editing, setEditing] = useState(false);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const canEdit = status !== "ended";

  const closeEditor = () => {
    setEditing(false);
    // Restore focus to the pencil so keyboard users land back where they
    // left off (story 17).
    requestAnimationFrame(() => editTriggerRef.current?.focus());
  };

  return (
    <li
      aria-label={pillCopy ? `${label} · ${pillCopy}` : label}
      className={cn(
        "rounded-2xl bg-card p-4 ring-1 ring-border",
        status === "ended" && "opacity-75",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-2xl"
        >
          {source.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium leading-tight">{label}</span>
            {status !== "active" && pillCopy && (
              <StatusPill status={status} copy={pillCopy} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {summary}
          </p>
        </div>
        {canEdit && !editing && (
          <button
            ref={editTriggerRef}
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      {editing && canEdit && (
        <IncomeSourceEditor
          source={source}
          currentMonthly={currentMonthly}
          currentMonth={currentMonth}
          onClose={closeEditor}
        />
      )}
    </li>
  );
}

/**
 * Inline editor mounted beneath the card header when the user clicks the
 * pencil. Owns yearly + apply-this-month state, fires
 * `updateIncomeBaselineAction`, and emits a success toast through
 * `useNotify`. The Save baseline button is conditionally rendered (not
 * just disabled) so a clean form doesn't show an inert primary CTA
 * (story 7).
 *
 * Dirty rule mirrors the modal's original logic: a write is meaningful
 * either when the yearly value diverges from the resolved current monthly
 * or when the user explicitly checks "apply this month" (writing a
 * current-month-effective row over the default next-month one).
 */
function IncomeSourceEditor({
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
  const initialYearly = currentMonthly * 12;
  const [yearlyInput, setYearlyInput] = useState(initialYearly.toString());
  const [applyThisMonth, setApplyThisMonth] = useState(false);

  const [state, formAction] = useActionState(
    updateIncomeBaselineAction,
    INCOME_ACTION_INITIAL,
  );

  useSuccessToast(
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
      className="mt-3 space-y-2 border-t border-border pt-3"
    >
      <input type="hidden" name="categoryId" value={source.id} />
      <div className="flex items-center gap-2">
        <label
          className="text-xs text-muted-foreground"
          htmlFor={yearlyId}
        >
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

/**
 * Detects the action's success transition (the `ok` counter increments
 * with no `error`), fires a toast computed lazily so the closure picks up
 * the latest `applyThisMonth` at commit time, and closes the editor.
 */
function useSuccessToast(
  state: IncomeActionState,
  computeMessage: () => string,
  onSuccess: () => void,
) {
  const notify = useNotify();
  const lastSeen = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastSeen.current && !state.error) {
      lastSeen.current = state.ok;
      notify.success(computeMessage());
      onSuccess();
    }
  }, [state, notify, computeMessage, onSuccess]);
}

function StatusPill({
  status,
  copy,
}: {
  status: Exclude<IncomeSourceStatus, "active">;
  copy: string;
}) {
  const palette = {
    "scheduled-change":
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    ended:
      "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  } satisfies Record<Exclude<IncomeSourceStatus, "active">, string>;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
        palette[status],
      )}
    >
      {copy}
    </span>
  );
}

function statusPillCopy(
  source: Category,
  status: IncomeSourceStatus,
): string | null {
  switch (status) {
    case "active":
      return null;
    case "scheduled-change":
      return "Scheduled change";
    case "ended":
      // `activeUntil` is guaranteed set when status === "ended".
      return `Ended ${monthLabel(source.activeUntil!)}`;
  }
}

function baselineSummary(
  source: Category,
  targets: CategoryTarget[],
  currentMonth: string,
  status: IncomeSourceStatus,
): string {
  if (status === "ended") {
    const lastBaseline =
      resolveTargetForMonth(source.id, source.activeUntil!, targets) * 12;
    return `Ended after ${monthLabel(source.activeUntil!)} · last baseline ${fmt(lastBaseline)}/yr`;
  }

  const currentMonthly = resolveTargetForMonth(source.id, currentMonth, targets);
  const currentYearly = currentMonthly * 12;
  const base = `${fmt(currentYearly)}/yr · ${fmt(currentMonthly)}/mo`;

  if (status === "scheduled-change") {
    const next = nextScheduledTarget(source.id, currentMonth, targets);
    if (next) {
      return `${base} → ${fmt(next.monthly * 12)}/yr starting ${monthLabel(next.effectiveFrom)}`;
    }
  }
  return base;
}

/**
 * Soonest target row for `categoryId` with `effectiveFrom > currentMonth`.
 * Returns `undefined` when no future-effective row exists.
 */
function nextScheduledTarget(
  categoryId: string,
  currentMonth: string,
  targets: CategoryTarget[],
): CategoryTarget | undefined {
  let best: CategoryTarget | undefined;
  for (const t of targets) {
    if (t.categoryId !== categoryId) continue;
    if (t.effectiveFrom <= currentMonth) continue;
    if (!best || t.effectiveFrom < best.effectiveFrom) best = t;
  }
  return best;
}
