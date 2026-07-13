import { mongoQuoteCache } from "@/lib/repositories/quotes";

import { resolveQuotes } from "./resolve";
import { TiingoPriceProvider } from "./tiingo";

/**
 * ~12h: quotes are refreshed on read once older than this. A monthly check-in
 * cadence means a page load rarely pays a fetch, keeping the app comfortably
 * inside the free-tier rate limit (story 13).
 */
export const DEFAULT_QUOTE_TTL_MS = 12 * 60 * 60 * 1000;

// The API key and platform `fetch` are stable per process, so construct the
// provider once (matching the single exported `mongoQuoteCache`). Tiingo is the
// quote source (#143) — it prices mutual-fund NAVs, which Finnhub's free tier
// doesn't. Tiingo now also backs ticker search (#144), so it's the app's sole
// market-data provider; Finnhub was dropped because its free `/search` returns
// nothing for mutual funds.
const provider = new TiingoPriceProvider();

/**
 * The app's live-price entry point (#109 chunk 3): current prices for `tickers`,
 * served from the Mongo cache and refreshed from Tiingo only when stale. Wires
 * the production cache + provider into the pure {@link resolveQuotes} policy.
 * Holdings with a manual `priceOverride` don't need a quote — callers should
 * pass only the tickers they actually need priced (override precedence lives in
 * `accountValue`).
 */
function resolveInput(tickers: string[]) {
  return {
    tickers,
    cache: mongoQuoteCache,
    provider,
    now: new Date().toISOString(),
    ttlMs: DEFAULT_QUOTE_TTL_MS,
  };
}

export async function getQuotes(tickers: string[]): Promise<Map<string, number>> {
  return (await resolveQuotes(resolveInput(tickers))).prices;
}

/**
 * Live prices **plus their cache timestamps** — for the Net Worth page's
 * staleness indicator (#109 chunk 6, story 19). `resolveQuotes` builds the
 * `asOf` map in the same pass it resolves prices (a refreshed ticker carries
 * `now`, a stale-fallback keeps its older stamp), so this needs no extra cache
 * read. Feed the pair to `pricingStatus` to derive the banner; values-only
 * callers (the check-in) stay on `getQuotes`.
 */
export async function getQuotesWithAsOf(
  tickers: string[],
): Promise<{ prices: Map<string, number>; asOf: Map<string, string> }> {
  return resolveQuotes(resolveInput(tickers));
}
