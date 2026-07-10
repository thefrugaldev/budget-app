"use client";

import { useState } from "react";

/**
 * Reset local (derived) state when a value-key changes, using React's sanctioned
 * "adjust state during render" pattern rather than an effect. `key` is a stable
 * string derived from the persisted props the local state mirrors; when it
 * changes, `resync` runs (calling the consumer's setters) in the same render, so
 * there's no extra commit. Compared by value, so an unrelated re-render that
 * leaves the key unchanged never clobbers an in-progress edit.
 *
 * Extracted because the edit sheet and each holding row both need it — see
 * `AccountEditSheet` (keyed on the account's persisted fields + open state) and
 * `HoldingRow` (keyed on the holding's fields).
 */
export function useResyncOnChange(key: string, resync: () => void): void {
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    resync();
  }
}
