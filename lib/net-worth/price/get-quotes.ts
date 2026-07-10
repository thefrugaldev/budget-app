import { mongoQuoteCache } from "@/lib/repositories/quotes";

import { FinnhubPriceProvider } from "./finnhub";
import { resolveQuotes } from "./resolve";

/**
 * ~12h: quotes are refreshed on read once older than this. A monthly check-in
 * cadence means a page load rarely pays a fetch, keeping the app comfortably
 * inside the free-tier rate limit (story 13).
 */
export const DEFAULT_QUOTE_TTL_MS = 12 * 60 * 60 * 1000;

// The API key and platform `fetch` are stable per process, so construct the
// provider once (matching the single exported `mongoQuoteCache`).
const provider = new FinnhubPriceProvider();

/**
 * The app's live-price entry point (#109 chunk 3): current prices for `tickers`,
 * served from the Mongo cache and refreshed from Finnhub only when stale. Wires
 * the production cache + provider into the pure {@link resolveQuotes} policy.
 * Holdings with a manual `priceOverride` don't need a quote — callers should
 * pass only the tickers they actually need priced (override precedence lives in
 * `accountValue`).
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, number>> {
  return resolveQuotes({
    tickers,
    cache: mongoQuoteCache,
    provider,
    now: new Date().toISOString(),
    ttlMs: DEFAULT_QUOTE_TTL_MS,
  });
}

/**
 * Live prices **plus their cache timestamps** — for the Net Worth page's
 * staleness indicator (#109 chunk 6, story 19). `getQuotes` refreshes stale
 * entries on read, so the `asOf` map read straight after reflects the post-fetch
 * state: a ticker the feed refreshed carries a `now`-ish stamp, while one the
 * feed couldn't refresh keeps its older cached stamp (or is absent from
 * `prices`). Feed the pair to `pricingStatus` to derive the banner. Values-only
 * callers (the check-in) stay on `getQuotes`.
 */
export async function getQuotesWithAsOf(
  tickers: string[],
): Promise<{ prices: Map<string, number>; asOf: Map<string, string> }> {
  const prices = await getQuotes(tickers);
  const asOf = new Map<string, string>();
  if (tickers.length > 0) {
    const cached = await mongoQuoteCache.read(tickers);
    for (const [ticker, quote] of cached) asOf.set(ticker, quote.asOf);
  }
  return { prices, asOf };
}
