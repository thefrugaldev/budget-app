import { mongoQuoteCache } from "@/lib/repositories/quotes";

import { FinnhubPriceProvider } from "./finnhub";
import { resolveQuotes } from "./resolve";

/**
 * ~12h: quotes are refreshed on read once older than this. A monthly check-in
 * cadence means a page load rarely pays a fetch, keeping the app comfortably
 * inside the free-tier rate limit (story 13).
 */
export const DEFAULT_QUOTE_TTL_MS = 12 * 60 * 60 * 1000;

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
    provider: new FinnhubPriceProvider(),
    now: new Date().toISOString(),
    ttlMs: DEFAULT_QUOTE_TTL_MS,
  });
}
