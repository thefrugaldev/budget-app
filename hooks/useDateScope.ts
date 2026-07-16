"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { presetDateBounds } from "@/lib/budget";

/** URL keys the date scope owns — a separate axis from the filter set (`q`/`vendor`/…). */
const SCOPE_PARAMS = { from: "from", to: "to" } as const;

/**
 * The `/transactions` date scope, bound to the URL. It is deliberately its own
 * axis, distinct from the row-attribute filter (`useTransactionFilterParams`):
 * a single page-level control owns `from`/`to`, so the old preset-chip vs.
 * date-filter intersection (issue #165 problem #4) can't happen — there is only
 * one date window.
 *
 * `raw` is exactly what's in the URL ("" when unset); `bounds` is the effective
 * inclusive ISO window after applying the **this-month default** (an empty URL
 * scopes to the current month, matching the pre-#165 landing behaviour). Writes
 * use `window.history.replaceState` (shallow, like the filter hook) so changing
 * scope re-runs only the client scope + list, never the dynamic server
 * component — the page already ships every transaction, so the client windows
 * them locally.
 */
export type DateScope = {
  /** Raw URL bounds — "" when the param is absent. */
  raw: { from: string; to: string };
  /** Effective inclusive ISO bounds, with the empty→this-month default applied. */
  bounds: { from: string; to: string };
  /** Write a new window; empty strings clear the params (→ this-month default). */
  setScope: (next: { from: string; to: string }) => void;
};

export function useDateScope(now: Date): DateScope {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // Key off the serialized string, not the object, which isn't referentially
  // stable across renders (same rationale as useTransactionFilterParams).
  const search = searchParams.toString();

  const raw = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      from: params.get(SCOPE_PARAMS.from)?.trim() ?? "",
      to: params.get(SCOPE_PARAMS.to)?.trim() ?? "",
    };
  }, [search]);

  const bounds = useMemo(() => {
    if (raw.from || raw.to) return raw;
    return presetDateBounds("this-month", now);
  }, [raw, now]);

  const setScope = useCallback(
    (next: { from: string; to: string }) => {
      const params = new URLSearchParams(search);
      if (next.from) params.set(SCOPE_PARAMS.from, next.from);
      else params.delete(SCOPE_PARAMS.from);
      if (next.to) params.set(SCOPE_PARAMS.to, next.to);
      else params.delete(SCOPE_PARAMS.to);
      const query = params.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [search, pathname],
  );

  return { raw, bounds, setScope };
}
