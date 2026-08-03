"use client";

import { CategoryEditSheet } from "@/components/budget/category/CategoryEditSheet";
import { useTargetSuggestionActions } from "@/hooks/useTargetSuggestionActions";
import type { TargetSuggestionView } from "@/types/target-suggestion";

const secondaryButton =
  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/**
 * The three shared Target-suggestion affordances — **Accept** (writes the
 * proposed cap next month + undo toast), **Not now** (snoozes it three months),
 * **Adjust…** (opens the edit sheet pre-filled) — plus the inline error and the
 * "Adjust…" sheet mount. Identical on the Pulse card and the category-detail
 * caption; only the container around it differs. Behaviour lives in
 * {@link useTargetSuggestionActions}.
 *
 * A pure edit affordance: every caller renders it inside a `useCanEdit()` gate,
 * and the actions enforce `requireRole("editor")` server-side regardless.
 */
export function SuggestionActions({
  view,
  now,
}: {
  view: TargetSuggestionView;
  now: Date;
}) {
  const { category, categoryTargets, txCount, suggestion } = view;
  const {
    handleAccept,
    handleDismiss,
    acceptPending,
    pending,
    error,
    adjustOpen,
    setAdjustOpen,
  } = useTargetSuggestionActions(view, now);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
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
        initialTargetOverride={suggestion.proposedTarget}
      />
    </>
  );
}
