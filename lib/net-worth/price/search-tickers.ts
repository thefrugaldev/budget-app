import type { TickerSearchProvider, TickerSearchResult } from "@/types/net-worth";

import { TiingoSearchProvider } from "./tiingo-search";

/**
 * Symbol-search entry point for the add-holding autocomplete (#144) — the
 * search equivalent of {@link ./get-quotes.getQuotes}. Guards the free-tier
 * rate limit before any network call (a too-short query returns nothing) and
 * caps the result list so the combobox stays scannable. The `searchTickersAction`
 * server action wraps this with the auth gate; the client debounces + caches.
 *
 * Backed by Tiingo (the same provider as quotes), not Finnhub: Finnhub's free
 * `/search` returns nothing for mutual funds, so it couldn't find most holdings
 * we can price. See {@link ./tiingo-search}.
 */

/** Below this the query is too broad to be useful and we don't hit the API. */
export const MIN_SEARCH_LENGTH = 2;
/** A combobox stays scannable at a handful of options; the API returns far more. */
export const MAX_SEARCH_RESULTS = 8;

// One instance per process — the API key and platform `fetch` are stable, same
// as the quote provider singleton in get-quotes.
const defaultProvider = new TiingoSearchProvider();

export async function searchTickers(
  query: string,
  provider: TickerSearchProvider = defaultProvider,
): Promise<TickerSearchResult[]> {
  if (query.trim().length < MIN_SEARCH_LENGTH) return [];
  const results = await provider.search(query);
  return results.slice(0, MAX_SEARCH_RESULTS);
}
