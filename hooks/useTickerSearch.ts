"use client";

import { useEffect, useRef, useState } from "react";

import { searchTickersAction } from "@/app/actions/net-worth";
import { MIN_SEARCH_LENGTH } from "@/lib/net-worth/price/search-tickers";
import type { TickerSearchResult } from "@/types/net-worth";

/**
 * Debounced ticker symbol-search for the add-holding combobox (#144). Waits for
 * a ~300ms typing pause and a minimum query length before hitting the server
 * action, so a burst of keystrokes costs one request, not one per key — keeping
 * well inside Tiingo's free-tier rate limit (50 req/hour).
 *
 * Results are cached per normalized query for the session (a module-level Map,
 * so it survives remounts of the form), and an incrementing sequence guard drops
 * a slow earlier response that lands after a newer query — the input never shows
 * stale matches for a query the user has moved on from.
 */
const DEBOUNCE_MS = 300;

// Session-lived: a symbol search is stable within a session, and the same few
// prefixes get retyped. Cleared only on reload.
const cache = new Map<string, TickerSearchResult[]>();

export function useTickerSearch(query: string): {
  results: TickerSearchResult[];
  loading: boolean;
} {
  const q = query.trim();
  // The synchronous answers — too-short and cache-hit — are derived during
  // render, not written with setState, so the effect only ever runs the async
  // fetch (no synchronous state churn inside it).
  const tooShort = q.length < MIN_SEARCH_LENGTH;
  const cached = tooShort ? undefined : cache.get(q);
  const needsFetch = !tooShort && cached === undefined;

  // Holds the most recent *fetched* batch, tagged with the query it answered, so
  // a resolved fetch for an abandoned query is ignored on render.
  const [fetched, setFetched] = useState<{ query: string; results: TickerSearchResult[] } | null>(
    null,
  );
  const seq = useRef(0);

  useEffect(() => {
    if (!needsFetch) return;
    const mySeq = ++seq.current;
    const timer = setTimeout(async () => {
      let found: TickerSearchResult[] = [];
      try {
        found = await searchTickersAction(q);
        cache.set(q, found);
      } catch {
        found = [];
      }
      if (mySeq === seq.current) setFetched({ query: q, results: found });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, needsFetch]);

  if (tooShort) return { results: [], loading: false };
  if (cached !== undefined) return { results: cached, loading: false };
  if (fetched?.query === q) return { results: fetched.results, loading: false };
  return { results: [], loading: true };
}
