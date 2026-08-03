"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/require-role";
import { currentMonthKey, nextMonth } from "@/lib/budget";
import { getCategoryById } from "@/lib/repositories/categories";
import {
  listCategoryTargetsFor,
  upsertCategoryTarget,
} from "@/lib/repositories/category-targets";
import {
  deleteTargetSuggestionDismissal,
  upsertTargetSuggestionDismissal,
} from "@/lib/repositories/target-suggestion-dismissals";

import {
  parseCategoryId,
  parseSuggestionAmount,
} from "./target-suggestion-parsers";
import type { TargetSuggestionActionState } from "./target-suggestion-state";

// `undo` typed via indexed access rather than importing the `AcceptUndo` name:
// the type stays co-located with the action state it belongs to, and lint:types
// only exempts `*ActionState` from the "shared types live in types/" rule.
function success(
  prev: TargetSuggestionActionState,
  undo?: TargetSuggestionActionState["undo"],
): TargetSuggestionActionState {
  return { error: null, ok: prev.ok + 1, undo };
}

function failure(
  prev: TargetSuggestionActionState,
  err: unknown,
): TargetSuggestionActionState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { error: message, ok: prev.ok };
}

// Accepting/dismissing a suggestion changes what Pulse ("/") and the category
// detail page show, and an accept edits target history exactly like a manual
// cap edit — so mirror `upsertCategoryTargetAction`'s revalidation (Settings
// lists ended categories' targets too).
function revalidateSuggestionSurfaces(categoryId: string): void {
  revalidatePath("/");
  revalidatePath(`/categories/${categoryId}`);
  revalidatePath("/settings");
}

/**
 * Accepts a Target suggestion: writes the proposed cap effective **next month**
 * through the same `upsertCategoryTarget` a manual edit uses (story 23 — no
 * special-case in target history), and clears any now-stale dismissal for the
 * category. Returns an undo payload (story 7): it captures the value that sat at
 * next month beforehand so the client can restore it — or delete the row this
 * accept inserted when there was none.
 *
 * The dismissal delete is a second write to a different collection; it isn't
 * transactional with the target upsert, but it doesn't need to be — a leftover
 * dismissal after the cap moved is already stale (its `dismissedAgainstTarget`
 * no longer matches the resolved cap), so the detector ignores it either way.
 */
export async function acceptTargetSuggestionAction(
  prev: TargetSuggestionActionState,
  formData: FormData,
): Promise<TargetSuggestionActionState> {
  try {
    await requireRole("editor");
    const categoryId = parseCategoryId(formData.get("categoryId"));
    const proposedTarget = parseSuggestionAmount(
      formData.get("proposedTarget"),
      "proposedTarget",
    );

    const cat = await getCategoryById(categoryId);
    if (!cat) throw new Error("Category not found");

    const effectiveFrom = nextMonth(currentMonthKey());

    // Capture the pre-accept value at next month for undo: a number if a row
    // already lived there (the upsert overwrites it), else null (it inserts one).
    const priorRow = (await listCategoryTargetsFor(categoryId)).find(
      (t) => t.effectiveFrom === effectiveFrom,
    );
    const previousMonthly = priorRow ? priorRow.monthly : null;

    await upsertCategoryTarget({
      categoryId,
      monthly: proposedTarget,
      effectiveFrom,
    });
    await deleteTargetSuggestionDismissal(categoryId);

    revalidateSuggestionSurfaces(categoryId);
    return success(prev, { categoryId, effectiveFrom, previousMonthly });
  } catch (err) {
    return failure(prev, err);
  }
}

/**
 * Dismisses (snoozes) a Target suggestion: upserts the per-category dismissal
 * row capturing the median and cap it was declined at, stamped now (ADR 0006).
 * The detector reads it back to honor the 3-month snooze and to re-surface only
 * on a materially larger divergence. One row per category — re-dismissing
 * overwrites the captured level rather than stacking rows.
 */
export async function dismissTargetSuggestionAction(
  prev: TargetSuggestionActionState,
  formData: FormData,
): Promise<TargetSuggestionActionState> {
  try {
    await requireRole("editor");
    const categoryId = parseCategoryId(formData.get("categoryId"));
    const dismissedMedian = parseSuggestionAmount(
      formData.get("dismissedMedian"),
      "dismissedMedian",
    );
    const dismissedAgainstTarget = parseSuggestionAmount(
      formData.get("dismissedAgainstTarget"),
      "dismissedAgainstTarget",
    );

    const cat = await getCategoryById(categoryId);
    if (!cat) throw new Error("Category not found");

    await upsertTargetSuggestionDismissal({
      categoryId,
      dismissedMedian,
      dismissedAgainstTarget,
    });

    revalidateSuggestionSurfaces(categoryId);
    return success(prev);
  } catch (err) {
    return failure(prev, err);
  }
}
