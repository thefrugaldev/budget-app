import type { CachedQuote, PriceProvider, QuoteCache } from "@/types/net-worth";

/** A cached quote is fresh while it's younger than the TTL at `now` (ISO datetimes). */
export function isFresh(asOf: string, now: string, ttlMs: number): boolean {
  return Date.parse(now) - Date.parse(asOf) < ttlMs;
}

/**
 * Resolve current prices for `tickers`, refreshing the cache only when stale
 * (story 13). Fresh cached quotes are served as-is; stale or missing ones are
 * fetched from the provider and written back stamped `now`. If the provider
 * can't quote a stale ticker — or the feed fails outright — the last cached
 * price is served rather than dropping to unpriced, so a transient feed outage
 * never blanks a valuation (the UI flags staleness separately, story 19).
 *
 * Pure orchestration over the injected {@link QuoteCache} and
 * {@link PriceProvider}, with `now`/`ttlMs` as parameters, so the whole
 * stale-refresh policy is unit-tested against fakes with no clock, Mongo, or
 * network.
 */
export async function resolveQuotes(input: {
  tickers: string[];
  cache: QuoteCache;
  provider: PriceProvider;
  now: string;
  ttlMs: number;
}): Promise<Map<string, number>> {
  const { cache, provider, now, ttlMs } = input;
  const tickers = [...new Set(input.tickers)];
  if (tickers.length === 0) return new Map();

  const cached = await cache.read(tickers);

  const prices = new Map<string, number>();
  const stale: string[] = [];
  for (const ticker of tickers) {
    const quote = cached.get(ticker);
    if (quote && isFresh(quote.asOf, now, ttlMs)) prices.set(ticker, quote.price);
    else stale.push(ticker);
  }
  if (stale.length === 0) return prices;

  let fetched: Map<string, number>;
  try {
    fetched = await provider.getQuotes(stale);
  } catch {
    fetched = new Map(); // feed failure — fall back to stale cache below
  }

  const toWrite: CachedQuote[] = [];
  for (const ticker of stale) {
    const price = fetched.get(ticker);
    if (price !== undefined) {
      prices.set(ticker, price);
      toWrite.push({ ticker, price, asOf: now });
    } else {
      // Provider couldn't quote it — serve the stale cached price if we have one.
      const quote = cached.get(ticker);
      if (quote) prices.set(ticker, quote.price);
    }
  }
  if (toWrite.length > 0) await cache.write(toWrite);
  return prices;
}
