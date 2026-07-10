import { afterEach, describe, expect, it, vi } from "vitest";

import { FinnhubPriceProvider, parseFinnhubQuote } from "./finnhub";

describe("parseFinnhubQuote", () => {
  it("reads the current price `c` from a real quote response", () => {
    // Shape of a Finnhub /quote body (fixture, invented numbers).
    const body = { c: 261.74, d: 1.2, dp: 0.46, h: 262.0, l: 259.1, o: 260.0, pc: 260.54, t: 1_720_000_000 };
    expect(parseFinnhubQuote(body)).toBe(261.74);
  });

  it("treats an unknown symbol (all-zero body) as no quote", () => {
    // Finnhub returns c:0 for a symbol it doesn't recognise.
    expect(parseFinnhubQuote({ c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 })).toBeUndefined();
  });

  it("rejects negative or non-numeric prices and malformed bodies", () => {
    expect(parseFinnhubQuote({ c: -5 })).toBeUndefined();
    expect(parseFinnhubQuote({ c: "261.74" })).toBeUndefined();
    expect(parseFinnhubQuote({})).toBeUndefined();
    expect(parseFinnhubQuote(null)).toBeUndefined();
    expect(parseFinnhubQuote("nope")).toBeUndefined();
  });
});

// Exercises getQuotes with an injected fake fetch — real shapes, no network.
type FetchSpec = { ok?: boolean; status?: number; body?: unknown };
function fakeFetch(byTicker: Record<string, FetchSpec>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const symbol = new URL(url).searchParams.get("symbol") ?? "";
    const spec = byTicker[symbol] ?? { ok: false, status: 404 };
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      json: async () => spec.body,
    } as Response;
  }) as typeof fetch;
}

describe("FinnhubPriceProvider.getQuotes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed prices, skipping non-OK and unquotable tickers", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new FinnhubPriceProvider(
      "test-key",
      fakeFetch({
        VOO: { body: { c: 500 } },
        AAPL: { ok: false, status: 429 }, // rate-limited
        GHOST: { body: { c: 0 } }, // unknown symbol
      }),
    );

    const prices = await provider.getQuotes(["VOO", "AAPL", "GHOST"]);

    expect(prices.get("VOO")).toBe(500);
    expect(prices.has("AAPL")).toBe(false);
    expect(prices.has("GHOST")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("AAPL")); // logged the 429
  });

  it("throws when the API key is missing but tickers are requested", async () => {
    const provider = new FinnhubPriceProvider(undefined, fakeFetch({}));
    await expect(provider.getQuotes(["VOO"])).rejects.toThrow(/FINNHUB_API_KEY/);
  });

  it("makes no request (and needs no key) for an empty ticker list", async () => {
    const fetchImpl = vi.fn(fakeFetch({}));
    const provider = new FinnhubPriceProvider(undefined, fetchImpl);
    expect((await provider.getQuotes([])).size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
