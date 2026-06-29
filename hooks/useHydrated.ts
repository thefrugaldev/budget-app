"use client";

import { useSyncExternalStore } from "react";

// No external store to subscribe to — the value never changes after hydration,
// so the subscribe callback is a no-op. All three are module-level constants so
// they're stable references across renders.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` during SSR and the first client render, `true` once hydrated.
 *
 * Lets a client component defer rendering markup it can't know on the server
 * (e.g. a `localStorage`-derived selection) until after hydration, matching the
 * server output on the first pass so there's no hydration mismatch — without a
 * `setState`-in-effect dance (which `react-hooks/set-state-in-effect` forbids).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
