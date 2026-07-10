import type { PriceProvider } from "@/types/net-worth";

/**
 * Finnhub free-tier price provider (ADR 0003). One symbol per `/quote` call;
 * 60 calls/min is ample at the app's monthly check-in cadence. Behind
 * `FINNHUB_API_KEY`. The rest of the app depends on the {@link PriceProvider}
 * interface, never on this class, so the provider stays a swap.
 */
const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";

/**
 * Parse a Finnhub `/quote` response into a current price, or `undefined` when
 * there's no usable quote. Finnhub returns `{ c: 0, ... }` (all zeros) for an
 * unknown symbol, so a non-positive `c` is treated as "no quote" rather than a
 * real $0 price. Pure — the unit tests exercise it against fixture JSON.
 */
export function parseFinnhubQuote(body: unknown): number | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const current = (body as { c?: unknown }).c;
  if (typeof current !== "number" || !Number.isFinite(current) || current <= 0) {
    return undefined;
  }
  return current;
}

export class FinnhubPriceProvider implements PriceProvider {
  constructor(
    private readonly apiKey = process.env.FINNHUB_API_KEY,
    // Injectable for tests; defaults to the platform fetch. The network is never
    // hit in unit tests — parsing is covered via `parseFinnhubQuote` directly.
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getQuotes(tickers: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    if (tickers.length === 0) return prices;
    if (!this.apiKey) throw new Error("Missing FINNHUB_API_KEY environment variable");

    for (const ticker of tickers) {
      const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(this.apiKey)}`;
      const res = await this.fetchImpl(url);
      if (!res.ok) continue; // skip this ticker; caller falls back to cache/override
      const price = parseFinnhubQuote(await res.json());
      if (price !== undefined) prices.set(ticker, price);
    }
    return prices;
  }
}
