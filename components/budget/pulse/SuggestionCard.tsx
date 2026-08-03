"use client";

import { useState, useTransition } from "react";

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
import { useNotify } from "@/hooks/useNotify";
import {
  currentMonthKey,
  fmt,
  monthLabel,
  nextMonth,
  thresholdColor,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { TargetSuggestionView } from "@/types/target-suggestion";

const secondaryButton =
  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

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
  const [acceptPending, startAccept] = useTransition();
  const [dismissPending, startDismiss] = useTransition();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveFrom = nextMonth(currentMonthKey(now));

  // Toasts are raised optimistically on click, NOT from a post-success effect.
  // A successful accept/dismiss revalidates Pulse, which drops the now-resolved
  // suggestion and unmounts THIS card in the same commit — a success effect here
  // would never run, so the user would get no feedback and an accepted change
  // (which takes effect next month) would look like a no-op. On failure the
  // action doesn't revalidate, so the card stays mounted and we retract the
  // optimistic toast, surfacing the error inline instead.
  function handleAccept() {
    setError(null);
    // Undo reverts the committed write. Its only server-derived input is the
    // value that sat at next month beforehand — but we already hold this
    // category's target rows, so derive it here: null ⇒ the accept inserted a
    // fresh row (undo deletes it); a number ⇒ restore it.
    const priorRow = categoryTargets.find(
      (t) => t.effectiveFrom === effectiveFrom,
    );
    const previousMonthly = priorRow ? priorRow.monthly : null;
    const pastTense = direction === "raise" ? "Raised" : "Lowered";
    notify.undoAction({
      id: `accept-${categoryId}`,
      title: `${pastTense} ${category.name} to ${fmt(proposedTarget)}/mo · from ${monthLabel(effectiveFrom)}`,
      onUndo: async () => {
        notify.dismiss(`accept-${categoryId}`);
        const undoFd = new FormData();
        undoFd.set("categoryId", categoryId);
        undoFd.set("effectiveFrom", effectiveFrom);
        let res;
        if (previousMonthly === null) {
          res = await deleteCategoryTargetAction(CATEGORY_ACTION_INITIAL, undoFd);
        } else {
          undoFd.set("monthly", String(previousMonthly));
          res = await upsertCategoryTargetAction(CATEGORY_ACTION_INITIAL, undoFd);
        }
        if (res.error) notify.error("Couldn't undo that", res.error);
        else notify.success(`Reverted ${category.name}`);
      },
    });
    startAccept(async () => {
      const fd = new FormData();
      fd.set("categoryId", categoryId);
      fd.set("proposedTarget", String(proposedTarget));
      const res = await acceptTargetSuggestionAction(
        TARGET_SUGGESTION_ACTION_INITIAL,
        fd,
      );
      if (res.error) {
        notify.dismiss(`accept-${categoryId}`);
        setError(res.error);
      }
    });
  }

  function handleDismiss() {
    setError(null);
    const toastId = notify.success(
      `Snoozed ${category.name} · we'll recheck in 3 months`,
    );
    startDismiss(async () => {
      const fd = new FormData();
      fd.set("categoryId", categoryId);
      fd.set("dismissedMedian", String(median));
      fd.set("dismissedAgainstTarget", String(currentTarget));
      const res = await dismissTargetSuggestionAction(
        TARGET_SUGGESTION_ACTION_INITIAL,
        fd,
      );
      if (res.error) {
        notify.dismiss(toastId);
        setError(res.error);
      }
    });
  }

  const verb = direction === "raise" ? "Raise" : "Lower";
  // Tone the direction chip from the *shared* signal source (not a bespoke
  // raise→red map) so it agrees with the meter: a category running over its
  // stale cap reads `bad`, one with comfortable headroom reads `good`. The word
  // carries the meaning; colour is reinforcement (accessibility baseline).
  const directionToneText = thresholdColor(category.kind, currentTarget, median).text;
  const pending = acceptPending || dismissPending;

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
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
            <span
              className={cn(
                "inline-flex shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium leading-none",
                directionToneText,
              )}
            >
              {verb}
            </span>
            <span>
              <span className="tabular-nums">{fmt(currentTarget)}</span>
              {" → "}
              <span className="tabular-nums">{fmt(proposedTarget)}</span>/mo
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleAccept}
          disabled={pending}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
