"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  applyTransactionFilterToParams,
  parseTransactionFilter,
} from "@/lib/budget";
import type { TransactionFilter } from "@/types/transaction";

/**
 * Binds the transaction filter set to the URL query string, mirroring how the
 * page's `?range=` preset already drives state. The URL is the single source of
 * truth — reads come straight from `useSearchParams`, so the back button,
 * bookmarks, and sharing all just work.
 *
 * Writes use the native `window.history.replaceState` (a shallow URL update
 * that Next syncs into the router, per the App Router SPA guide) rather than
 * `router.replace`. `router.replace` performs a soft navigation, which re-runs
 * the dynamic `/transactions` server component — and thus `listAllTransactions()`
 * over every doc — on *every keystroke*, discarding an identical result (the
 * page reads only `range` on the server). That redundant round-trip, not the
 * virtualized client render, is the multi-second lag at scale (issue #165
 * chunk 1). `replaceState` updates the URL in place, `useSearchParams` re-reads
 * it, and the client-side filter re-runs — with no server work. It also adds no
 * history entry per keystroke, preserving the old `router.replace` semantics.
 *
 * Unrelated params (notably `range`) are preserved, and an empty filter yields
 * a clean URL.
 */
export function useTransactionFilterParams(): [
  TransactionFilter,
  (next: TransactionFilter) => void,
] {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Key off the serialized string, not the searchParams object: Next's
  // useSearchParams return value isn't guaranteed referentially stable across
  // renders, so depending on the object would rebuild the memo every render.
  const search = searchParams.toString();

  const filter = useMemo(
    () => parseTransactionFilter(new URLSearchParams(search)),
    [search],
  );

  const setFilter = useCallback(
    (next: TransactionFilter) => {
      const params = applyTransactionFilterToParams(
        new URLSearchParams(search),
        next,
      );
      const query = params.toString();
      // Shallow, client-only URL update: no server round-trip, no scroll jump,
      // no extra history entry. Next's patched history integrates this back into
      // the router so `useSearchParams` (and the `filter` memo above) re-reads it.
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [search, pathname],
  );

  return [filter, setFilter];
}
