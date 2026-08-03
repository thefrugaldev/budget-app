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
import { useNotify } from "@/hooks/useNotify";
import { currentMonthKey, fmt, monthLabel, nextMonth } from "@/lib/budget";
import type { TargetSuggestionView } from "@/types/target-suggestion";

/**
 * The accept / dismiss / adjust behaviour behind a Target suggestion, shared by
 * both surfaces it appears on — the Pulse "Worth revisiting" card and the
 * category-detail chart caption (#186). Extracted so the two render the same
 * three affordances over identical logic rather than cloning it.
 *
 * Toasts are raised optimistically on click, NOT from a post-success effect: a
 * successful accept/dismiss revalidates the surface, which drops the resolved
 * suggestion and unmounts the caller in the same commit — a success effect
 * would never run, and an accepted change (effective next month) would look
 * like a no-op. On failure the action doesn't revalidate, so the caller stays
 * mounted; we retract the optimistic toast and surface `error` inline instead.
 */
export function useTargetSuggestionActions(
  view: TargetSuggestionView,
  now: Date,
): {
  handleAccept: () => void;
  handleDismiss: () => void;
  acceptPending: boolean;
  dismissPending: boolean;
  pending: boolean;
  error: string | null;
  adjustOpen: boolean;
  setAdjustOpen: (open: boolean) => void;
} {
  const { suggestion, category, categoryTargets } = view;
  const { categoryId, direction, currentTarget, proposedTarget, median } =
    suggestion;
  const notify = useNotify();
  const [acceptPending, startAccept] = useTransition();
  const [dismissPending, startDismiss] = useTransition();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveFrom = nextMonth(currentMonthKey(now));

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

  return {
    handleAccept,
    handleDismiss,
    acceptPending,
    dismissPending,
    pending: acceptPending || dismissPending,
    error,
    adjustOpen,
    setAdjustOpen,
  };
}
