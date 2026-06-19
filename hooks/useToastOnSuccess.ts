"use client";

import { useEffect, useRef } from "react";

import type { CategoryActionState } from "@/app/actions/category-state";
import { useNotify } from "@/hooks/useNotify";

/**
 * Generic "fire a success toast once when an action transitions to success"
 * effect, shared across the category Edit sheet and the target-history rows.
 * The message is computed lazily so closures over fast-changing form state
 * (e.g. a per-row monthly input) read the current value at fire time. The
 * optional `onSuccess` runs after the toast — used to close a row/dialog.
 */
export function useToastOnSuccess(
  state: CategoryActionState,
  computeMessage: () => string,
  onSuccess?: () => void,
) {
  const notify = useNotify();
  const lastSeen = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastSeen.current && !state.error) {
      lastSeen.current = state.ok;
      notify.success(computeMessage());
      onSuccess?.();
    }
  }, [state, onSuccess, notify, computeMessage]);
}
