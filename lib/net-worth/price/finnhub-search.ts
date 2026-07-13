import type { TickerSearchProvider, TickerSearchResult } from "@/types/net-worth";

/**
 * Finnhub free-tier symbol search (#144) — the autocomplete source for adding a
 * holding. A *different* endpoint and shape from the `/quote` provider in
 * `./finnhub`: `/search?q=` returns `{ count, result: [{ symbol, displaySymbol,
 * description, type }] }`. Kept on Finnhub (not Tiingo) so type-ahead traffic
 * stays off Tiingo's quote quota (#143). The app depends only on the
 * {@link TickerSearchProvider} interface, so this stays a swap.
 */
const FINNHUB_SEARCH_URL = "https://finnhub.io/api/v1/search";

/**
 * Parse a Finnhub `/search` body into `{ symbol, description }` matches. Pure, so
 * the unit tests exercise it against fixture JSON. Prefers `displaySymbol` (the
 * human-facing ticker, e.g. `BRK.B`) over the raw `symbol`; drops rows missing
 * either field and de-dupes by symbol, so the combobox never shows a blank or
 * duplicate option. Order is preserved (Finnhub returns best matches first).
 */
export function parseFinnhubSearch(body: unknown): TickerSearchResult[] {
  if (typeof body !== "object" || body === null) return [];
  const result = (body as { result?: unknown }).result;
  if (!Array.isArray(result)) return [];

  const out: TickerSearchResult[] = [];
  const seen = new Set<string>();
  for (const row of result) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as { symbol?: unknown; displaySymbol?: unknown; description?: unknown };
    const display = typeof r.displaySymbol === "string" ? r.displaySymbol.trim() : "";
    const raw = typeof r.symbol === "string" ? r.symbol.trim() : "";
    const symbol = display !== "" ? display : raw;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    if (symbol === "" || description === "" || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol, description });
  }
  return out;
}

export class FinnhubSearchProvider implements TickerSearchProvider {
  constructor(
    private readonly apiKey = process.env.FINNHUB_API_KEY,
    // Injectable for tests; defaults to the platform fetch. The network is never
    // hit in unit tests — parsing is covered via `parseFinnhubSearch` directly.
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: string): Promise<TickerSearchResult[]> {
    const q = query.trim();
    if (q === "") return [];
    const key = this.apiKey;
    if (!key) throw new Error("Missing FINNHUB_API_KEY environment variable");

    const url = `${FINNHUB_SEARCH_URL}?q=${encodeURIComponent(q)}&token=${encodeURIComponent(key)}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      // 401 (bad key), 429 (rate-limited), 5xx all read as "no matches" to the
      // caller; log the status so a Finnhub outage is distinguishable in ops.
      console.warn(`Finnhub search failed for "${q}": HTTP ${res.status}`);
      return [];
    }
    return parseFinnhubSearch(await res.json());
  }
}
