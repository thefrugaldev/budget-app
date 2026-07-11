"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { localTodayIso } from "@/lib/net-worth/local-today";

/**
 * The browser's local calendar day (`YYYY-MM-DD`) once hydrated, `""` before.
 * Centralizes the SSR-safety both net-worth date submits need: the empty string
 * on the SSR/first render means no hydration mismatch, and callers gate their
 * submit on a non-empty value so a record/close never falls back to the server's
 * UTC day. See `localTodayIso` for why local (not UTC) is the record date.
 */
export function useLocalTodayIso(): string {
  return useHydrated() ? localTodayIso() : "";
}
