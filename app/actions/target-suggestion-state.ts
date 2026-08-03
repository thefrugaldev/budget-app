/**
 * State returned by the Target-suggestion accept/dismiss actions (#186 chunk 4).
 * `error`/`ok` mirror `CategoryActionState`: `error` surfaces an inline message,
 * `ok` increments on each success so a `useEffect` can edge-detect a transition
 * without re-firing on stale renders. `undo` is present only after a successful
 * **accept** — it's the payload the client needs to offer a one-tap revert.
 */
export type TargetSuggestionActionState = {
  error: string | null;
  ok: number;
  undo?: AcceptUndo;
};

/**
 * Everything needed to reverse an accepted suggestion via the *existing* target
 * actions (story 7). Accept writes the proposed cap at `effectiveFrom` (next
 * month); to undo, the client restores what sat there before — a `number` means
 * upsert it back, `null` means accept inserted a fresh row so undo deletes it.
 */
export type AcceptUndo = {
  categoryId: string;
  /** The month the accept wrote the new Target to (next month). */
  effectiveFrom: string;
  /** The Target value at `effectiveFrom` before the accept, or `null` if none existed. */
  previousMonthly: number | null;
};

export const TARGET_SUGGESTION_ACTION_INITIAL: TargetSuggestionActionState = {
  error: null,
  ok: 0,
};
