import type { CachedQuote, PriceProvider, QuoteCache } from "@/types/net-worth";

/**
 * A cached quote is fresh while its age at `now` is within the TTL (ISO
 * datetimes). A negative age — an `asOf` in the future, only from clock skew —
 * reads as *not* fresh, so a skewed quote is refetched rather than trusted
 * indefinitely.
 */
export function isFresh(asOf: string, now: string, ttlMs: number): boolean {
  const age = Date.parse(now) - Date.parse(asOf);
  return age >= 0 && age < ttlMs;
}

/**
 * Resolve current prices for `tickers`, refreshing the cache only when stale
 * (story 13). Fresh cached quotes are served as-is; stale or missing ones are
 * fetched from the provider and written back stamped `now`. If the provider
 * can't quote a stale ticker — or the feed fails outright — the last cached
 * price is served rather than dropping to unpriced, so a transient feed outage
 * never blanks a valuation (the UI flags staleness separately, story 19).
 *
 * Returns `prices` **and** each price's `asOf` timestamp, built in the same pass
 * (the cache is already open here): a freshly-fetched price carries `now`, a
 * fresh cache hit its cached stamp, and a stale-fallback its *old* stamp — which
 * is exactly what `pricingStatus` needs to flag the banner. Callers that only
 * need values (the check-in) read `.prices`; the Net Worth page reads both,
 * avoiding a second cache round trip.
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
}): Promise<{ prices: Map<string, number>; asOf: Map<string, string> }> {
  const { cache, provider, now, ttlMs } = input;
  const tickers = [...new Set(input.tickers)];
  const prices = new Map<string, number>();
  const asOf = new Map<string, string>();
  if (tickers.length === 0) return { prices, asOf };

  const cached = await cache.read(tickers);

  const stale: string[] = [];
  for (const ticker of tickers) {
    const quote = cached.get(ticker);
    if (quote && isFresh(quote.asOf, now, ttlMs)) {
      prices.set(ticker, quote.price);
      asOf.set(ticker, quote.asOf);
    } else {
      stale.push(ticker);
    }
  }
  if (stale.length === 0) return { prices, asOf };

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
      asOf.set(ticker, now);
      toWrite.push({ ticker, price, asOf: now });
    } else {
      // Provider couldn't quote it — serve the stale cached price if we have one,
      // keeping its old stamp so the page can still flag it as stale.
      const quote = cached.get(ticker);
      if (quote) {
        prices.set(ticker, quote.price);
        asOf.set(ticker, quote.asOf);
      }
    }
  }
  if (toWrite.length > 0) await cache.write(toWrite);
  return { prices, asOf };
}
