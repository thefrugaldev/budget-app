/**
 * Shape returned by every category server action. Mirrors `IncomeActionState`:
 * `error` surfaces inline validation; `ok` increments on each successful
 * action so a `useEffect` can detect a success transition without re-firing
 * on stale renders. `id` carries the newly-created/affected category id so
 * the UI can navigate after create.
 */
export type CategoryActionState = {
  error: string | null;
  ok: number;
  id?: string;
};

export const CATEGORY_ACTION_INITIAL: CategoryActionState = {
  error: null,
  ok: 0,
};
