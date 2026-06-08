/**
 * Shape returned by every income server action. The dialog reads `error` to
 * surface a validation message inline; `ok` increments on each successful
 * action so a `useEffect` can detect a success transition and close the
 * modal without re-firing on stale renders.
 */
export type IncomeActionState = {
  error: string | null;
  ok: number;
};

export const INCOME_ACTION_INITIAL: IncomeActionState = { error: null, ok: 0 };
