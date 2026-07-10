import type { PricingStatus } from "@/types/net-worth";

import { isFresh } from "./price/resolve";

/**
 * Whether the live prices behind the headline can be trusted (#109 chunk 6,
 * story 19). Derived purely from the resolved prices + their cache timestamps so
 * it's unit-testable with no clock or network. Only feed-priced tickers matter —
 * a holding with a manual override is never stale (the user set it), so callers
 * pass the *needed* tickers (see `tickersNeedingQuotes`), not every ticker. The
 * {@link PricingStatus} shape it returns lives in `@/types/net-worth`.
 */
export function pricingStatus(input: {
  neededTickers: string[];
  prices: Map<string, number>;
  asOf: Map<string, string>;
  now: string;
  ttlMs: number;
}): PricingStatus {
  const { neededTickers, prices, asOf, now, ttlMs } = input;
  const unpriced: string[] = [];
  let pricedAt: string | null = null;
  let stale = false;

  for (const ticker of neededTickers) {
    if (!prices.has(ticker)) {
      unpriced.push(ticker);
      continue;
    }
    const stamp = asOf.get(ticker);
    // A priced ticker with no/old timestamp is a stale cache hit (the feed
    // couldn't refresh it); freshly-fetched prices carry a `now`-ish stamp.
    if (!stamp || !isFresh(stamp, now, ttlMs)) stale = true;
    if (stamp && (pricedAt === null || stamp < pricedAt)) pricedAt = stamp;
  }

  return { pricedAt, stale, unpriced };
}
