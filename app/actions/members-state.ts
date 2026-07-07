/**
 * Shape returned by every Members & Invites server action (#111 chunk 6),
 * matching the `IncomeActionState`/`CategoryActionState` contract so the shared
 * `useActionSuccessToast` and inline-error rendering work unchanged: `error`
 * drives the inline message, `ok` increments on success so a form can detect the
 * success transition and reset without re-firing on stale renders.
 */
export type MemberActionState = {
  error: string | null;
  ok: number;
};

export const MEMBER_ACTION_INITIAL: MemberActionState = { error: null, ok: 0 };
