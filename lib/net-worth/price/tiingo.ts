import type { PriceProvider } from "@/types/net-worth";

/**
 * Tiingo end-of-day price provider (#143, ADR 0003). Replaces Finnhub as the
 * quote source: Finnhub's free `/quote` returns `c: 0` for a mutual fund, but a
 * real portfolio is full of 401k / index / target-date funds (`FXAIX`, `VTSAX`,
 * `VFIFX`). Tiingo's EOD daily endpoint prices **stocks, ETFs, and mutual-fund
 * NAVs** from one API, which is the right fit for a monthly-cadence app with a
 * 12h quote cache — funds only price once a day at NAV, so realtime buys nothing.
 * The rest of the app depends on the {@link PriceProvider} interface, never on
 * this class, so the provider stays a swap (that's the whole point).
 */
const TIINGO_DAILY_URL = "https://api.tiingo.com/tiingo/daily";

/**
 * Parse a Tiingo daily-prices response into a current price/NAV, or `undefined`
 * when there's no usable quote. The endpoint returns a JSON **array** of daily
 * rows in ascending date order; with no date params that's a single latest row,
 * so the last element is always the most recent. We read `close` (the raw close
 * / fund NAV — not `adjClose`, which is split/dividend-adjusted for return
 * series, not current market value). An empty array or a non-array body reads as
 * "no quote". A non-positive close is **deliberately** unpriced too: a live fund
 * NAV is always positive, so `0`/negative means no usable quote (a delisted or
 * wound-up fund is then valued via the manual `priceOverride`) — not a leftover
 * of the Finnhub `c: 0` workaround. Pure — the unit tests exercise it against
 * fixture JSON.
 */
export function parseTiingoQuote(body: unknown): number | undefined {
  if (!Array.isArray(body) || body.length === 0) return undefined;
  const latest = body[body.length - 1];
  if (typeof latest !== "object" || latest === null) return undefined;
  const close = (latest as { close?: unknown }).close;
  if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) {
    return undefined;
  }
  return close;
}

export class TiingoPriceProvider implements PriceProvider {
  constructor(
    private readonly apiKey = process.env.TIINGO_API_KEY,
    // Injectable for tests; defaults to the platform fetch. The network is never
    // hit in unit tests — parsing is covered via `parseTiingoQuote` directly.
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getQuotes(tickers: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    if (tickers.length === 0) return prices;
    const key = this.apiKey;
    if (!key) throw new Error("Missing TIINGO_API_KEY environment variable");

    // One EOD call per symbol, fired in parallel. Tiingo's free tier has no
    // multi-symbol endpoint that covers *mutual funds* — the batch IEX endpoint
    // is exchange-traded only, and the bulk-download add-on is paid — so the
    // per-ticker daily endpoint is the one free path that prices funds. A
    // single-user refresh of a handful of holdings, gated by the 12h cache, sits
    // far under the 50 req/hour free-tier limit, and parallelism avoids paying N
    // serial round-trips on the first read past the TTL.
    const entries = await Promise.all(
      tickers.map(async (ticker): Promise<readonly [string, number] | null> => {
        const url = `${TIINGO_DAILY_URL}/${encodeURIComponent(ticker)}/prices`;
        try {
          const res = await this.fetchImpl(url, {
            headers: { Accept: "application/json", Authorization: `Token ${key}` },
          });
          if (!res.ok) {
            // 404 (unknown ticker), 401 (bad key), 429 (rate-limited), 5xx all look
            // like "no quote" to the caller; log the status so a Tiingo outage or a
            // fund Tiingo can't price is distinguishable in ops (the manual price
            // override is the fallback for the latter).
            console.warn(`Tiingo quote failed for ${ticker}: HTTP ${res.status}`);
            return null;
          }
          const price = parseTiingoQuote(await res.json());
          return price !== undefined ? [ticker, price] : null;
        } catch (err) {
          // Isolate per ticker: a network error or a malformed 200 body (e.g. a
          // maintenance HTML page that fails `res.json()`) drops just this ticker
          // to stale-cache fallback in resolveQuotes, rather than fail-fast'ing
          // the whole batch through Promise.all and dropping the siblings too.
          const detail = err instanceof Error ? err.message : String(err);
          console.warn(`Tiingo quote failed for ${ticker}: ${detail}`);
          return null;
        }
      }),
    );
    for (const entry of entries) if (entry) prices.set(entry[0], entry[1]);
    return prices;
  }
}
