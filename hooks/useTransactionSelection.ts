"use client";

import { useCallback, useMemo, useState } from "react";

import {
  areAllSelected,
  areSomeSelected,
  withAdded,
  withRemoved,
  withToggled,
} from "@/lib/transaction-selection";

/**
 * Selection state for the transaction list's bulk-operation mode (issue #17
 * chunk 4). A thin wrapper over the pure helpers in `lib/transaction-selection`
 * — the set algebra lives there (and is unit-tested); this hook only holds the
 * `Set<string>` in React state and the mobile "selection mode" flag.
 *
 * Shared verbatim by the category-detail list and the global `/transactions`
 * list (chunk 5), so it takes no list-specific arguments — callers pass the
 * relevant id arrays (a streak's underlying ids, a day's ids, every id in
 * range) into `selectMany` / `setMany` / `all` / `isAllSelected`.
 *
 * Mobile reveals checkboxes only once `selectionMode` is on (entered via a
 * row long-press); desktop ignores the flag and shows checkboxes always.
 * `cancel()` is the bar's Cancel button: clear the selection *and* leave
 * selection mode.
 */
export function useTransactionSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [selectionMode, setSelectionMode] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected((cur) => withToggled(cur, id));
  }, []);

  // Selecting a collapsed streak passes all its underlying ids here.
  const selectMany = useCallback((ids: readonly string[]) => {
    setSelected((cur) => withAdded(cur, ids));
  }, []);

  const deselectMany = useCallback((ids: readonly string[]) => {
    setSelected((cur) => withRemoved(cur, ids));
  }, []);

  // Backs a select-all box (day header / top-level): tick adds the group,
  // untick removes it. `on` is the box's *target* state.
  const setMany = useCallback((ids: readonly string[], on: boolean) => {
    setSelected((cur) => (on ? withAdded(cur, ids) : withRemoved(cur, ids)));
  }, []);

  const all = useCallback((ids: readonly string[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, []);

  const cancel = useCallback(() => {
    setSelected(new Set());
    setSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const isAllSelected = useCallback(
    (ids: readonly string[]) => areAllSelected(selected, ids),
    [selected],
  );

  const isSomeSelected = useCallback(
    (ids: readonly string[]) => areSomeSelected(selected, ids),
    [selected],
  );

  return useMemo(
    () => ({
      selected,
      count: selected.size,
      selectionMode,
      isSelected,
      isAllSelected,
      isSomeSelected,
      toggle,
      selectMany,
      deselectMany,
      setMany,
      all,
      clear,
      enterSelectionMode,
      cancel,
    }),
    [
      selected,
      selectionMode,
      isSelected,
      isAllSelected,
      isSomeSelected,
      toggle,
      selectMany,
      deselectMany,
      setMany,
      all,
      clear,
      enterSelectionMode,
      cancel,
    ],
  );
}

export type TransactionSelection = ReturnType<typeof useTransactionSelection>;
