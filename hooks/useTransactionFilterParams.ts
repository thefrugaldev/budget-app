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

  const filter = useMemo(
    () => parseTransactionFilter(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilter = useCallback(
    (next: TransactionFilter) => {
      const params = applyTransactionFilterToParams(
        new URLSearchParams(searchParams.toString()),
        next,
      );
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname],
  );

  return [filter, setFilter];
}
