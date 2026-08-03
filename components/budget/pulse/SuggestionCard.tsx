"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  deleteCategoryTargetAction,
  upsertCategoryTargetAction,
} from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import {
  acceptTargetSuggestionAction,
  dismissTargetSuggestionAction,
} from "@/app/actions/target-suggestions";
import { TARGET_SUGGESTION_ACTION_INITIAL } from "@/app/actions/target-suggestion-state";
import { CategoryEditSheet } from "@/components/budget/category/CategoryEditSheet";
import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { Sparkline } from "@/components/budget/category/Sparkline";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useNotify } from "@/hooks/useNotify";
import { currentMonthKey, fmt, monthLabel, nextMonth } from "@/lib/budget";
import type { TargetSuggestionView } from "@/types/target-suggestion";

const secondaryButton =
  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/**
 * One "Worth revisiting" row (#186): the evidence for a single Target
 * suggestion and its three one-tap actions. Accept writes the proposed cap next
 * month and raises an undo toast; "Not now" snoozes it; "Adjust…" opens the
 * existing category edit sheet pre-filled with the proposal. Direction is
 * carried in the word "Raise"/"Lower" and the arrow — never colour alone.
 *
 * Rendered only inside `WorthRevisiting`, which is hidden wholesale from
 * viewers via `useCanEdit()`; the server actions enforce `requireRole("editor")`
 * regardless, so this stays a pure edit affordance.
 */
export function SuggestionCard({
  view,
  now,
}: {
  view: TargetSuggestionView;
  now: Date;
}) {
  const { suggestion, category, categoryTargets, txCount, series } = view;
  const { categoryId, direction, currentTarget, proposedTarget, median } =
    suggestion;
  const notify = useNotify();
  const [, startTransition] = useTransition();
  const [adjustOpen, setAdjustOpen] = useState(false);

  const effectiveFrom = nextMonth(currentMonthKey(now));

  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptTargetSuggestionAction,
    TARGET_SUGGESTION_ACTION_INITIAL,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissTargetSuggestionAction,
    TARGET_SUGGESTION_ACTION_INITIAL,
  );

  useActionSuccessToast(
    dismissState,
    () => `Snoozed ${category.name} · we'll recheck in 3 months`,
  );

  // Accept confirms via its own undo toast rather than a plain success — the
  // write has already committed, so the "Undo" reverts it (restoring the prior
  // next-month value, or deleting the row this accept inserted). Edge-detected
  // like `useActionSuccessToast`, but with a bespoke toast the shared hook can't
  // express.
  const acceptSeen = useRef(acceptState.ok);
  useEffect(() => {
    if (acceptState.ok <= acceptSeen.current || acceptState.error) return;
    acceptSeen.current = acceptState.ok;
    const undo = acceptState.undo;
    const verb = direction === "raise" ? "Raised" : "Lowered";
    notify.undoAction({
      id: `accept-${categoryId}-${acceptState.ok}`,
      title: `${verb} ${category.name} to ${fmt(proposedTarget)}/mo · from ${monthLabel(effectiveFrom)}`,
      onUndo: async () => {
        if (!undo) return;
        const fd = new FormData();
        fd.set("categoryId", undo.categoryId);
        fd.set("effectiveFrom", undo.effectiveFrom);
        // The accept already committed; undo is a reverting write — restore the
        // value that sat at next month, or delete the row the accept inserted.
        let res;
        if (undo.previousMonthly === null) {
          res = await deleteCategoryTargetAction(CATEGORY_ACTION_INITIAL, fd);
        } else {
          fd.set("monthly", String(undo.previousMonthly));
          res = await upsertCategoryTargetAction(CATEGORY_ACTION_INITIAL, fd);
        }
        if (res.error) notify.error("Couldn't undo that", res.error);
        else notify.success(`Reverted ${category.name}`);
      },
    });
  }, [
    acceptState,
    notify,
    direction,
    categoryId,
    category.name,
    proposedTarget,
    effectiveFrom,
  ]);

  function handleAccept() {
    const fd = new FormData();
    fd.set("categoryId", categoryId);
    fd.set("proposedTarget", String(proposedTarget));
    startTransition(() => acceptAction(fd));
  }

  function handleDismiss() {
    const fd = new FormData();
    fd.set("categoryId", categoryId);
    fd.set("dismissedMedian", String(median));
    fd.set("dismissedAgainstTarget", String(currentTarget));
    startTransition(() => dismissAction(fd));
  }

  const verb = direction === "raise" ? "Raise" : "Lower";
  const pending = acceptPending || dismissPending;
  const error = acceptState.error ?? dismissState.error;

  return (
    <li className="rounded-xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <CategoryIcon category={category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate font-medium">{category.name}</p>
            <Sparkline totals={series} className="mt-0.5 shrink-0" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Typically <span className="tabular-nums">{fmt(median)}</span>/mo over
            the last 6 months.
          </p>
          <p className="mt-1.5 text-sm font-medium">
            <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground">
              {verb}
            </span>
            <span className="tabular-nums">{fmt(currentTarget)}</span>
            {" → "}
            <span className="tabular-nums">{fmt(proposedTarget)}</span>/mo
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAccept}
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {acceptPending ? "Accepting…" : "Accept"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={pending}
          className={secondaryButton}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => setAdjustOpen(true)}
          disabled={pending}
          className={secondaryButton}
        >
          Adjust…
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-signal-bad-foreground">
          {error}
        </p>
      )}

      <CategoryEditSheet
        category={category}
        targets={categoryTargets}
        txCount={txCount}
        now={now}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        initialTargetOverride={proposedTarget}
      />
    </li>
  );
}
