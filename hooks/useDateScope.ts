"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { presetDateBounds } from "@/lib/budget";
import type { DateScopeCommit } from "@/types/range";

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
 * scopes to the current month, matching the pre-#165 landing behaviour).
 *
 * The `commit` mode picks how a change reaches the URL (see {@link
 * DateScopeCommit}): `"shallow"` (default) keeps the transactions behaviour —
 * `replaceState`, no server round-trip — while `"navigate"` soft-navigates so a
 * server-aggregated page (Pulse, #160) re-derives its figures. Either way the
 * `from`/`to` URL contract is identical, so the same control serves both.
 */
export type DateScope = {
  /** Raw URL bounds — "" when the param is absent. */
  raw: { from: string; to: string };
  /** Effective inclusive ISO bounds, with the empty→this-month default applied. */
  bounds: { from: string; to: string };
  /** Write a new window; empty strings clear the params (→ this-month default). */
  setScope: (next: { from: string; to: string }) => void;
};

export function useDateScope(
  now: Date,
  commit: DateScopeCommit = "shallow",
): DateScope {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
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
      const url = query ? `${pathname}?${query}` : pathname;
      // Navigate mode re-runs the server component (Pulse re-aggregates);
      // shallow mode re-windows client-side only. `scroll: false` keeps the
      // viewport put when only the range changed.
      if (commit === "navigate") router.replace(url, { scroll: false });
      else window.history.replaceState(null, "", url);
    },
    [search, pathname, commit, router],
  );

  return { raw, bounds, setScope };
}
