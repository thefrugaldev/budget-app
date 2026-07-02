"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useActionState, useMemo, useState, useTransition } from "react";

import {
  updateCategoryAction,
  upsertCategoryTargetAction,
} from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { CategoryLifecycleActions } from "@/components/budget/category/CategoryLifecycleActions";
import { CategoryTargetHistory } from "@/components/budget/category/CategoryTargetHistory";
import { SectionHeader } from "@/components/budget/category/SectionHeader";
import { CategoryIconPicker } from "@/components/budget/category/CategoryIconPicker";
import { MonthPickerField } from "@/components/ui/MonthPickerField";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import {
  currentMonthKey,
  fmt,
  monthLabel,
  nextMonth,
  resolveTargetForMonth,
  targetLabel,
} from "@/lib/budget";
import { monthlyToYearly, yearlyToMonthly } from "@/lib/income";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind, CategoryTarget } from "@/types/budget";

const KIND_LABELS = {
  expense: "Expense",
  savings: "Savings",
  income: "Income",
} as const satisfies Record<CategoryKind, string>;
const KIND_OPTIONS = (Object.keys(KIND_LABELS) as readonly CategoryKind[]).map(
  (value) => ({ value, label: KIND_LABELS[value] }),
);

/**
 * Off-canvas Edit category sheet. Right-side flyout on desktop, full-screen
 * on mobile. Houses the existing editor surfaces — Details, Cap, Status
 * (lifecycle), and target history — under one scroll region with a single
 * footer Save button. Per-section dirty dots surface unsaved work.
 *
 * Status actions (End / Reopen / Delete) remain individually-triggered —
 * they are discrete mutations, not part of the form save.
 */
export function CategoryEditSheet({
  category,
  targets,
  txCount,
  now,
  open,
  onOpenChange,
}: {
  category: Category;
  targets: CategoryTarget[];
  txCount: number;
  now: Date;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const thisMonth = currentMonthKey(now);
  const myTargets = useMemo(
    () =>
      targets
        .filter((t) => t.categoryId === category.id)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),
    [targets, category.id],
  );
  const currentTarget = resolveTargetForMonth(category.id, thisMonth, targets);
  // Income targets are stored monthly but entered/displayed as gross yearly
  // (income_model). The section-2 input below works in `currentTargetDisplay`
  // — yearly for income, monthly for expense/savings — and converts back to
  // monthly at the save boundary. Expense and savings caps/goals are unchanged.
  const isIncome = category.kind === "income";
  const currentTargetDisplay = isIncome
    ? monthlyToYearly(currentTarget)
    : currentTarget;
  const canHardDelete = txCount === 0 && myTargets.length <= 1;
  const isEnded = category.activeUntil !== undefined;
  const kindLocked = txCount > 0;

  // Controlled inputs so we can dirty-track each section against the
  // persisted category. The defaults reset whenever the persisted shape
  // changes (after a save lands) — see the resync effect below.
  const [name, setName] = useState(category.name);
  const [emoji, setEmoji] = useState(category.emoji);
  const [kind, setKind] = useState<CategoryKind>(category.kind);
  const [activeFrom, setActiveFrom] = useState(category.activeFrom);
  const [activeUntil, setActiveUntil] = useState(category.activeUntil ?? "");
  const [showEndDate, setShowEndDate] = useState(isEnded);
  // Held in the displayed unit (yearly for income, monthly otherwise).
  const [targetInput, setTargetInput] = useState(currentTargetDisplay.toString());
  const [applyThisMonth, setApplyThisMonth] = useState(false);

  // Reset local input state when the persisted shape changes (a save lands
  // and the parent re-renders with the new category/target props) or when
  // the sheet transitions closed→open (clean slate per editing session).
  // Implemented as a render-time prev-prop comparison — React 19's
  // set-state-in-effect rule forbids the more obvious useEffect form, and
  // this matches the React docs' "adjust state when a prop changes" pattern.
  const [prev, setPrev] = useState({ category, currentTarget, open });
  const persistedChanged =
    prev.category !== category || prev.currentTarget !== currentTarget;
  const justOpened = open && !prev.open;
  if (persistedChanged || justOpened) {
    setPrev({ category, currentTarget, open });
    setName(category.name);
    setEmoji(category.emoji);
    setKind(category.kind);
    setActiveFrom(category.activeFrom);
    setActiveUntil(category.activeUntil ?? "");
    setShowEndDate(category.activeUntil !== undefined);
    setTargetInput(currentTargetDisplay.toString());
    setApplyThisMonth(false);
  } else if (prev.open !== open) {
    setPrev({ ...prev, open });
  }

  const [detailsState, detailsAction, detailsPending] = useActionState(
    updateCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  const [capState, capAction, capPending] = useActionState(
    upsertCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  const [, startTransition] = useTransition();

  useActionSuccessToast(detailsState, () => "Category updated");
  useActionSuccessToast(
    capState,
    () =>
      `${targetLabel(category.kind)} updated · effective ${monthLabel(
        applyThisMonth ? thisMonth : nextMonth(thisMonth),
      )}`,
  );

  const parsedInput = Number(targetInput);
  const targetChanged =
    Number.isFinite(parsedInput) && parsedInput !== currentTargetDisplay;
  const capDirty = targetChanged || applyThisMonth;

  const detailsDirty =
    name !== category.name ||
    emoji !== category.emoji ||
    kind !== category.kind ||
    activeFrom !== category.activeFrom ||
    (showEndDate
      ? activeUntil !== (category.activeUntil ?? "")
      : isEnded);

  const dirty = detailsDirty || capDirty;
  const pending = detailsPending || capPending;
  const error = detailsState.error ?? capState.error;

  function handleSave() {
    startTransition(() => {
      if (detailsDirty) {
        const fd = new FormData();
        fd.set("id", category.id);
        fd.set("emoji", emoji);
        fd.set("name", name);
        fd.set("kind", kind);
        fd.set("activeFrom", activeFrom);
        if (showEndDate && activeUntil) fd.set("activeUntil", activeUntil);
        detailsAction(fd);
      }
      if (capDirty) {
        const fd = new FormData();
        fd.set("categoryId", category.id);
        // Storage is monthly across all kinds; income enters yearly, so
        // convert at the boundary before the action persists it.
        const monthlyValue = isIncome
          ? yearlyToMonthly(parsedInput)
          : parsedInput;
        fd.set("monthly", String(monthlyValue));
        if (applyThisMonth) fd.set("applyThisMonth", "on");
        capAction(fd);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup
          aria-modal="true"
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-xl ring-1 ring-border outline-none",
            // Mobile: full-screen
            "inset-0",
            // Desktop: right-side flyout
            "md:inset-y-0 md:right-0 md:left-auto md:w-[480px] md:rounded-l-2xl",
            // Enter/exit animations: slide in from the right on desktop,
            // fade on mobile (full-screen so no slide direction reads well).
            "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-[opacity,transform]",
            "md:data-[ending-style]:translate-x-full md:data-[starting-style]:translate-x-full md:data-[ending-style]:opacity-100 md:data-[starting-style]:opacity-100",
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
            <Dialog.Title className="font-heading text-lg font-semibold">
              Edit {category.name}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5 text-sm">
              <section className="space-y-3">
                <SectionHeader title="Details" dirty={detailsDirty} />
                <div className="grid grid-cols-[64px_1fr] gap-2">
                  <CategoryIconPicker
                    value={emoji}
                    onChange={setEmoji}
                    nameHint={name}
                    ariaLabel="Choose category icon"
                  />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    aria-label="Name"
                    className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
                  />
                </div>
                {kindLocked ? (
                  <div className="space-y-1">
                    <span className="block text-xs font-medium text-muted-foreground">
                      Kind
                    </span>
                    <p className="text-sm">{KIND_LABELS[category.kind]}</p>
                    <span className="block text-[11px] text-muted-foreground">
                      Locked: {txCount} transaction{txCount === 1 ? "" : "s"}{" "}
                      would be re-interpreted by a kind change. Delete or move
                      them first.
                    </span>
                  </div>
                ) : (
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Kind
                    </span>
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as CategoryKind)}
                      className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
                    >
                      {KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-muted-foreground">
                    Active from
                  </span>
                  <MonthPickerField
                    value={activeFrom}
                    onChange={setActiveFrom}
                    required
                    ariaLabel="Active from"
                  />
                </div>
                {showEndDate ? (
                  <div className="space-y-1">
                    <span className="block text-xs font-medium text-muted-foreground">
                      Active until
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <MonthPickerField
                          value={activeUntil}
                          onChange={setActiveUntil}
                          required
                          ariaLabel="Active until"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEndDate(false);
                          setActiveUntil("");
                        }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Saving with an end date set retires the category from
                      the overview after that month. Clear to leave open-ended.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowEndDate(true)}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    + Set end date
                  </button>
                )}
              </section>

              <hr className="border-border" />

              <section className="space-y-3">
                <SectionHeader
                  title={targetLabel(category.kind)}
                  dirty={capDirty}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {fmt(currentTargetDisplay)}/{isIncome ? "yr" : "mo"}.
                  New values apply from {monthLabel(nextMonth(thisMonth))} unless
                  you override.
                </p>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isIncome ? "Yearly" : "Monthly"}
                  </span>
                  <AmountInput
                    precision={isIncome ? "whole" : "cents"}
                    variant="display"
                    value={targetInput}
                    onChange={setTargetInput}
                    allowZero
                    ariaLabel={isIncome ? "Yearly" : "Monthly"}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={applyThisMonth}
                    onChange={(e) => setApplyThisMonth(e.target.checked)}
                    className="size-3.5 accent-foreground"
                  />
                  Apply this month ({monthLabel(thisMonth)})
                </label>
              </section>

              <hr className="border-border" />

              <CategoryLifecycleActions
                category={category}
                isEnded={isEnded}
                canHardDelete={canHardDelete}
                txCount={txCount}
                targetRowCount={myTargets.length}
              />

              <hr className="border-border" />

              <CategoryTargetHistory
                categoryId={category.id}
                targets={myTargets}
                kind={category.kind}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="border-t border-border bg-destructive/10 px-5 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Close
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || pending}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
