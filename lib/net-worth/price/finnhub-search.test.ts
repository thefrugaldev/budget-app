import { afterEach, describe, expect, it, vi } from "vitest";

import { FinnhubSearchProvider, parseFinnhubSearch } from "./finnhub-search";

describe("parseFinnhubSearch", () => {
  it("maps result rows to { symbol, description }, preferring displaySymbol", () => {
    // Shape of a Finnhub /search body (fixture, real shape).
    const body = {
      count: 2,
      result: [
        { description: "APPLE INC", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" },
        { description: "BERKSHIRE HATHAWAY B", displaySymbol: "BRK.B", symbol: "BRK.B", type: "Common Stock" },
      ],
    };
    expect(parseFinnhubSearch(body)).toEqual([
      { symbol: "AAPL", description: "APPLE INC" },
      { symbol: "BRK.B", description: "BERKSHIRE HATHAWAY B" },
    ]);
  });

  it("drops rows missing a symbol or description, and de-dupes by symbol", () => {
    const body = {
      result: [
        { description: "APPLE INC", displaySymbol: "AAPL", symbol: "AAPL" },
        { description: "", displaySymbol: "NODESC", symbol: "NODESC" }, // no description
        { description: "No symbol co", displaySymbol: "", symbol: "" }, // no symbol
        { description: "APPLE INC (dup)", displaySymbol: "AAPL", symbol: "AAPL" }, // dupe symbol
      ],
    };
    expect(parseFinnhubSearch(body)).toEqual([{ symbol: "AAPL", description: "APPLE INC" }]);
  });

  it("returns [] for malformed bodies", () => {
    expect(parseFinnhubSearch({})).toEqual([]);
    expect(parseFinnhubSearch({ result: "nope" })).toEqual([]);
    expect(parseFinnhubSearch(null)).toEqual([]);
    expect(parseFinnhubSearch("nope")).toEqual([]);
  });
});

// Injected fake fetch keyed by the `q` query param — real shapes, no network.
function fakeFetch(byQuery: Record<string, { ok?: boolean; status?: number; body?: unknown }>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const q = new URL(url).searchParams.get("q") ?? "";
    const spec = byQuery[q] ?? { ok: false, status: 404 };
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      json: async () => spec.body,
    } as Response;
  }) as typeof fetch;
}

describe("FinnhubSearchProvider.search", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed matches for a hit", async () => {
    const provider = new FinnhubSearchProvider(
      "test-key",
      fakeFetch({
        appl: { body: { result: [{ description: "APPLE INC", displaySymbol: "AAPL", symbol: "AAPL" }] } },
      }),
    );
    expect(await provider.search("appl")).toEqual([{ symbol: "AAPL", description: "APPLE INC" }]);
  });

  it("degrades to [] on a non-OK response (rate limit / bad key / outage)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new FinnhubSearchProvider("test-key", fakeFetch({ x: { ok: false, status: 429 } }));
    expect(await provider.search("x")).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("returns [] for a blank query without calling the network", async () => {
    let called = false;
    const provider = new FinnhubSearchProvider("test-key", (async () => {
      called = true;
      return { ok: true, json: async () => ({}) } as Response;
    }) as typeof fetch);
    expect(await provider.search("   ")).toEqual([]);
    expect(called).toBe(false);
  });

  it("throws when the API key is missing", async () => {
    const provider = new FinnhubSearchProvider(undefined, fakeFetch({}));
    await expect(provider.search("aapl")).rejects.toThrow(/FINNHUB_API_KEY/);
  });
});
