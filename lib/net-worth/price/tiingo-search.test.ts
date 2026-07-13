import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTiingoSearch, TiingoSearchProvider } from "./tiingo-search";

describe("parseTiingoSearch", () => {
  it("maps active US equity-like rows to { symbol, description } — funds included", () => {
    // Shape of a Tiingo utilities/search body (fixture, real shape).
    const body = [
      { name: "Apple Inc", ticker: "AAPL", assetType: "Stock", isActive: true, countryCode: "US" },
      {
        name: "VANGUARD TOTAL STOCK MARKET INDEX FUND ADMIRAL SHARES",
        ticker: "VTSAX",
        assetType: "Mutual Fund",
        isActive: true,
        countryCode: "US",
      },
      { name: "Vanguard S&P 500 ETF", ticker: "VOO", assetType: "ETF", isActive: true, countryCode: "US" },
    ];
    expect(parseTiingoSearch(body)).toEqual([
      { symbol: "AAPL", description: "Apple Inc" },
      { symbol: "VTSAX", description: "VANGUARD TOTAL STOCK MARKET INDEX FUND ADMIRAL SHARES" },
      { symbol: "VOO", description: "Vanguard S&P 500 ETF" },
    ]);
  });

  it("drops inactive, non-US, and non-equity rows, and de-dupes by symbol", () => {
    const body = [
      { name: "Apple Inc", ticker: "AAPL", assetType: "Stock", isActive: true, countryCode: "US" },
      { name: "Apple Inc (Canada)", ticker: "AAPL", assetType: "Stock", isActive: true, countryCode: "CA" },
      { name: "Delisted Co", ticker: "DEAD", assetType: "Stock", isActive: false, countryCode: "US" },
      { name: "Bitcoin", ticker: "BTCUSD", assetType: "Crypto", isActive: true, countryCode: "US" },
      { name: "Apple dup", ticker: "AAPL", assetType: "Stock", isActive: true, countryCode: "US" },
    ];
    expect(parseTiingoSearch(body)).toEqual([{ symbol: "AAPL", description: "Apple Inc" }]);
  });

  it("returns [] for a non-array or malformed body", () => {
    expect(parseTiingoSearch({})).toEqual([]);
    expect(parseTiingoSearch(null)).toEqual([]);
    expect(parseTiingoSearch("nope")).toEqual([]);
    expect(parseTiingoSearch([{ ticker: "", name: "", assetType: "Stock", isActive: true, countryCode: "US" }])).toEqual([]);
  });
});

// Injected fake fetch keyed by the `query` param — real shapes, no network.
function fakeFetch(
  byQuery: Record<string, { ok?: boolean; status?: number; body?: unknown }>,
  onCall?: (url: string, init?: RequestInit) => void,
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    onCall?.(url, init);
    const q = new URL(url).searchParams.get("query") ?? "";
    const spec = byQuery[q] ?? { ok: false, status: 404 };
    return { ok: spec.ok ?? true, status: spec.status ?? 200, json: async () => spec.body } as Response;
  }) as typeof fetch;
}

describe("TiingoSearchProvider.search", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed matches and sends the key as an Authorization header, not in the URL", async () => {
    let seenUrl = "";
    let seenAuth: string | undefined;
    const provider = new TiingoSearchProvider(
      "secret-key",
      fakeFetch(
        { vtsax: { body: [{ name: "Vanguard Total Stock", ticker: "VTSAX", assetType: "Mutual Fund", isActive: true, countryCode: "US" }] } },
        (url, init) => {
          seenUrl = url;
          seenAuth = (init?.headers as Record<string, string>)?.Authorization;
        },
      ),
    );
    expect(await provider.search("vtsax")).toEqual([
      { symbol: "VTSAX", description: "Vanguard Total Stock" },
    ]);
    expect(seenAuth).toBe("Token secret-key");
    expect(seenUrl).not.toContain("secret-key"); // key isn't leaked into the URL
  });

  it("degrades to [] on a non-OK response (rate limit / bad key / outage)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new TiingoSearchProvider("k", fakeFetch({ x: { ok: false, status: 429 } }));
    expect(await provider.search("x")).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("degrades to [] when the body isn't valid JSON (maintenance page)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new TiingoSearchProvider("k", (async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    })) as unknown as typeof fetch);
    expect(await provider.search("aapl")).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("returns [] for a blank query without calling the network", async () => {
    let called = false;
    const provider = new TiingoSearchProvider("k", (async () => {
      called = true;
      return { ok: true, json: async () => [] } as Response;
    }) as typeof fetch);
    expect(await provider.search("   ")).toEqual([]);
    expect(called).toBe(false);
  });

  it("throws when the API key is missing", async () => {
    const provider = new TiingoSearchProvider(undefined, fakeFetch({}));
    await expect(provider.search("aapl")).rejects.toThrow(/TIINGO_API_KEY/);
  });
});
