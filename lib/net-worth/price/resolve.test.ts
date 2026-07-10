import { describe, expect, it, vi } from "vitest";

import type { CachedQuote, PriceProvider, QuoteCache } from "@/types/net-worth";

import { isFresh, resolveQuotes } from "./resolve";

const HOUR = 60 * 60 * 1000;
const TTL = 12 * HOUR;
const NOW = "2026-07-10T12:00:00.000Z";

/** In-memory QuoteCache seeded with the given quotes; records what gets written. */
function fakeCache(seed: CachedQuote[] = []) {
  const store = new Map(seed.map((q) => [q.ticker, q]));
  const writes: CachedQuote[] = [];
  const cache: QuoteCache = {
    async read(tickers) {
      const out = new Map<string, CachedQuote>();
      for (const t of tickers) if (store.has(t)) out.set(t, store.get(t)!);
      return out;
    },
    async write(quotes) {
      for (const q of quotes) {
        store.set(q.ticker, q);
        writes.push(q);
      }
    },
  };
  return { cache, writes };
}

function fakeProvider(quotes: Record<string, number>): PriceProvider {
  return { getQuotes: vi.fn(async (tickers: string[]) =>
    new Map(tickers.filter((t) => t in quotes).map((t) => [t, quotes[t]])),
  ) };
}

describe("isFresh", () => {
  it("is fresh strictly within the TTL and stale at/after it", () => {
    expect(isFresh("2026-07-10T06:00:00.000Z", NOW, TTL)).toBe(true); // 6h old
    expect(isFresh("2026-07-09T23:00:00.000Z", NOW, TTL)).toBe(false); // 13h old
  });
});

describe("resolveQuotes", () => {
  it("serves fresh cached quotes without calling the provider", async () => {
    const { cache, writes } = fakeCache([{ ticker: "VOO", price: 500, asOf: "2026-07-10T06:00:00.000Z" }]);
    const provider = fakeProvider({ VOO: 999 });

    const prices = await resolveQuotes({ tickers: ["VOO"], cache, provider, now: NOW, ttlMs: TTL });

    expect(prices.get("VOO")).toBe(500); // cached, not the provider's 999
    expect(provider.getQuotes).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it("fetches stale/missing tickers and writes them back stamped now", async () => {
    const { cache, writes } = fakeCache([{ ticker: "VOO", price: 480, asOf: "2026-07-09T00:00:00.000Z" }]); // stale
    const provider = fakeProvider({ VOO: 500, AAPL: 200 });

    const prices = await resolveQuotes({ tickers: ["VOO", "AAPL"], cache, provider, now: NOW, ttlMs: TTL });

    expect(prices.get("VOO")).toBe(500); // refreshed
    expect(prices.get("AAPL")).toBe(200); // freshly fetched
    expect(provider.getQuotes).toHaveBeenCalledWith(["VOO", "AAPL"]);
    expect(writes).toEqual([
      { ticker: "VOO", price: 500, asOf: NOW },
      { ticker: "AAPL", price: 200, asOf: NOW },
    ]);
  });

  it("falls back to a stale cached price when the provider can't quote it", async () => {
    const { cache, writes } = fakeCache([{ ticker: "OLD", price: 42, asOf: "2026-07-01T00:00:00.000Z" }]);
    const provider = fakeProvider({}); // quotes nothing

    const prices = await resolveQuotes({ tickers: ["OLD"], cache, provider, now: NOW, ttlMs: TTL });

    expect(prices.get("OLD")).toBe(42); // stale price served rather than dropped
    expect(writes).toEqual([]); // nothing fresh to persist
  });

  it("falls back to stale cache when the whole feed throws", async () => {
    const { cache } = fakeCache([{ ticker: "VOO", price: 480, asOf: "2026-07-01T00:00:00.000Z" }]);
    const provider: PriceProvider = { getQuotes: vi.fn(async () => { throw new Error("feed down"); }) };

    const prices = await resolveQuotes({ tickers: ["VOO"], cache, provider, now: NOW, ttlMs: TTL });

    expect(prices.get("VOO")).toBe(480);
  });

  it("omits a ticker that is neither cached nor quotable", async () => {
    const { cache } = fakeCache();
    const prices = await resolveQuotes({ tickers: ["GHOST"], cache, provider: fakeProvider({}), now: NOW, ttlMs: TTL });
    expect(prices.has("GHOST")).toBe(false);
  });

  it("dedupes tickers and skips the provider entirely when none are given", async () => {
    const { cache } = fakeCache();
    const provider = fakeProvider({});
    expect((await resolveQuotes({ tickers: [], cache, provider, now: NOW, ttlMs: TTL })).size).toBe(0);
    expect(provider.getQuotes).not.toHaveBeenCalled();
  });
});
