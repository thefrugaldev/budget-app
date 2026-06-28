"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  applyTransactionFilterToParams,
  parseTransactionFilter,
  type TransactionFilter,
} from "@/lib/budget";

/**
 * Binds the transaction filter set to the URL query string, mirroring how the
 * page's `?range=` preset already drives state. The URL is the single source of
 * truth — reads come straight from `useSearchParams`, so the back button,
 * bookmarks, and sharing all just work — and writes use `router.replace` for a
 * soft navigation that doesn't push a history entry per keystroke. Unrelated
 * params (notably `range`) are preserved, and an empty filter yields a clean URL.
 */
export function useTransactionFilterParams(): [
  TransactionFilter,
  (next: TransactionFilter) => void,
] {
  const searchParams = useSearchParams();
  const router = useRouter();
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
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [search, router, pathname],
  );

  return [filter, setFilter];
}
