"use client";

import { useEffect, useRef } from "react";

import { useNotify } from "@/hooks/useNotify";

/**
 * Minimal structural shape every server-action state in the repo already
 * satisfies — `IncomeActionState`, `CategoryActionState`,
 * `TransactionActionState`. Accepting the shape rather than a union keeps
 * this hook decoupled from any specific action and lets future action
 * states drop in without touching the import here.
 */
export type ActionState = {
  error: string | null;
  ok: number;
};

/**
 * Detects the success transition on a `useActionState` result and fires a
 * toast plus an optional callback. Success = `state.ok` increments AND
 * `state.error` is null on the same tick. The message is computed lazily
 * inside the success branch so a closure over fast-changing form state
 * (toggles, inputs) reads the value at commit time without per-render
 * bookkeeping.
 *
 * Failures stay quiet here on purpose — the action's form is the right
 * surface for inline error copy, not the toast layer.
 */
export function useActionSuccessToast(
  state: ActionState,
  computeMessage: () => string,
  onSuccess?: () => void,
): void {
  const notify = useNotify();
  const lastSeen = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastSeen.current && !state.error) {
      lastSeen.current = state.ok;
      notify.success(computeMessage());
      onSuccess?.();
    }
  }, [state, notify, computeMessage, onSuccess]);
}
