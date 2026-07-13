import type { TickerSearchProvider, TickerSearchResult } from "@/types/net-worth";

/**
 * Tiingo symbol search (#144) — the autocomplete source for adding a holding.
 * Uses the **same provider as quotes** (Tiingo, #143) on purpose: Finnhub's free
 * `/search` returns *nothing* for mutual funds (verified — `VTSAX`/`VTIAX`/
 * `FXAIX` all come back empty), which is most of a real portfolio, so searching
 * there couldn't find holdings we can actually price. Tiingo's `utilities/search`
 * covers stocks, ETFs, and mutual-fund NAVs — matching what the quote path can
 * price. This reverses #143's "keep search on Finnhub to spare Tiingo's quota"
 * call: search is debounced + min-length + session-cached, so it costs only a
 * trickle of Tiingo's 50/hour free-tier budget, and Finnhub is dropped entirely.
 * The app depends only on the {@link TickerSearchProvider} interface, so this
 * stays a swap.
 */
const TIINGO_SEARCH_URL = "https://api.tiingo.com/tiingo/utilities/search";

// Instruments you'd hold in an account here. Tiingo also returns crypto/FX and
// leveraged-synthetic rows for a query; keep the equity-like kinds only.
const ALLOWED_ASSET_TYPES = new Set(["Stock", "ETF", "Mutual Fund"]);

/**
 * Parse a Tiingo `utilities/search` body into `{ symbol, description }` matches.
 * Pure, so the unit tests exercise it against fixture JSON. The endpoint returns
 * a top-level JSON array of `{ ticker, name, assetType, isActive, countryCode }`.
 * We keep only **active US** rows of an {@link ALLOWED_ASSET_TYPES} kind — that
 * drops the delisted, foreign-listing, and synthetic-ticker noise a bare query
 * returns — map `ticker → symbol` / `name → description`, and de-dupe by symbol.
 * Order is preserved (Tiingo returns best matches first).
 */
export function parseTiingoSearch(body: unknown): TickerSearchResult[] {
  if (!Array.isArray(body)) return [];

  const out: TickerSearchResult[] = [];
  const seen = new Set<string>();
  for (const row of body) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as {
      ticker?: unknown;
      name?: unknown;
      assetType?: unknown;
      isActive?: unknown;
      countryCode?: unknown;
    };
    if (r.isActive !== true || r.countryCode !== "US") continue;
    if (typeof r.assetType !== "string" || !ALLOWED_ASSET_TYPES.has(r.assetType)) continue;
    const symbol = typeof r.ticker === "string" ? r.ticker.trim().toUpperCase() : "";
    const description = typeof r.name === "string" ? r.name.trim() : "";
    if (symbol === "" || description === "" || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol, description });
  }
  return out;
}

export class TiingoSearchProvider implements TickerSearchProvider {
  constructor(
    private readonly apiKey = process.env.TIINGO_API_KEY,
    // Injectable for tests; defaults to the platform fetch. The network is never
    // hit in unit tests — parsing is covered via `parseTiingoSearch` directly.
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string): Promise<TickerSearchResult[]> {
    const q = query.trim();
    if (q === "") return [];
    const key = this.apiKey;
    if (!key) throw new Error("Missing TIINGO_API_KEY environment variable");

    // Header auth (not `?token=`) so the key never lands in a URL or a log line —
    // same as the quote provider.
    const url = `${TIINGO_SEARCH_URL}?query=${encodeURIComponent(q)}`;
    try {
      const res = await this.fetchImpl(url, {
        headers: { Accept: "application/json", Authorization: `Token ${key}` },
      });
      if (!res.ok) {
        // 401 (bad key), 429 (rate-limited), 5xx all read as "no matches"; log the
        // status so a Tiingo outage is distinguishable in ops.
        console.warn(`Tiingo search failed for "${q}": HTTP ${res.status}`);
        return [];
      }
      return parseTiingoSearch(await res.json());
    } catch (err) {
      // A network error or a malformed 200 (e.g. a maintenance HTML page that
      // fails res.json()) degrades to no matches rather than throwing mid-keystroke.
      console.warn(`Tiingo search failed for "${q}": ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
