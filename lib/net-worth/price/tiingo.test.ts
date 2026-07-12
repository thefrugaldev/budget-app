import { afterEach, describe, expect, it, vi } from "vitest";

import { parseTiingoQuote, TiingoPriceProvider } from "./tiingo";

describe("parseTiingoQuote", () => {
  it("reads `close` from a stock/ETF EOD row", () => {
    // Shape of a Tiingo /tiingo/daily/<t>/prices row (fixture, invented numbers).
    const body = [
      {
        date: "2026-07-10T00:00:00.000Z",
        close: 512.83,
        high: 514.1,
        low: 510.0,
        open: 511.2,
        volume: 3_200_000,
        adjClose: 512.83,
      },
    ];
    expect(parseTiingoQuote(body)).toBe(512.83);
  });

  it("prices a mutual-fund NAV (the whole point of #143 — Finnhub returns c:0 here)", () => {
    const fxaix = [{ date: "2026-07-10T00:00:00.000Z", close: 209.14, adjClose: 209.14 }];
    expect(parseTiingoQuote(fxaix)).toBe(209.14);
  });

  it("takes the most recent (last) row of an ascending range", () => {
    const range = [
      { date: "2026-07-08T00:00:00.000Z", close: 200 },
      { date: "2026-07-09T00:00:00.000Z", close: 205 },
      { date: "2026-07-10T00:00:00.000Z", close: 210 },
    ];
    expect(parseTiingoQuote(range)).toBe(210);
  });

  it("treats an empty array (no data) as no quote", () => {
    expect(parseTiingoQuote([])).toBeUndefined();
  });

  it("rejects negative / non-numeric closes and malformed bodies", () => {
    expect(parseTiingoQuote([{ close: -5 }])).toBeUndefined();
    expect(parseTiingoQuote([{ close: "209.14" }])).toBeUndefined();
    expect(parseTiingoQuote([{ open: 200 }])).toBeUndefined(); // no close field
    expect(parseTiingoQuote([null])).toBeUndefined();
    expect(parseTiingoQuote({})).toBeUndefined(); // not an array
    expect(parseTiingoQuote(null)).toBeUndefined();
    expect(parseTiingoQuote("nope")).toBeUndefined();
  });
});

// Exercises getQuotes with an injected fake fetch — real shapes, no network. The
// ticker rides the URL *path* (`/tiingo/daily/<ticker>/prices`), not a query param.
type FetchSpec = {
  ok?: boolean;
  status?: number;
  body?: unknown;
  /** Simulate a 200 whose body fails to parse (e.g. a maintenance HTML page). */
  jsonThrows?: boolean;
  /** Simulate a network-level fetch rejection for this ticker. */
  networkError?: boolean;
};
function fakeFetch(byTicker: Record<string, FetchSpec>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    const match = new URL(url).pathname.match(/\/tiingo\/daily\/([^/]+)\/prices/);
    const symbol = match ? decodeURIComponent(match[1]) : "";
    const spec = byTicker[symbol] ?? { ok: false, status: 404 };
    if (spec.networkError) throw new TypeError("fetch failed");
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      json: async () => {
        if (spec.jsonThrows) throw new SyntaxError("Unexpected token < in JSON");
        return spec.body;
      },
    } as Response;
  }) as typeof fetch;
}

describe("TiingoPriceProvider.getQuotes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns parsed prices, skipping non-OK and unquotable tickers", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new TiingoPriceProvider(
      "test-key",
      fakeFetch({
        VOO: { body: [{ close: 500 }] },
        FXAIX: { body: [{ close: 209.14 }] }, // mutual fund — priced by Tiingo
        AAPL: { ok: false, status: 429 }, // rate-limited
        GHOST: { ok: false, status: 404 }, // unknown ticker
      }),
    );

    const prices = await provider.getQuotes(["VOO", "FXAIX", "AAPL", "GHOST"]);

    expect(prices.get("VOO")).toBe(500);
    expect(prices.get("FXAIX")).toBe(209.14);
    expect(prices.has("AAPL")).toBe(false);
    expect(prices.has("GHOST")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("AAPL")); // logged the 429
  });

  it("isolates a malformed 200 body / network error to its ticker, keeping siblings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const provider = new TiingoPriceProvider(
      "test-key",
      fakeFetch({
        VOO: { body: [{ close: 500 }] }, // healthy sibling
        BADJSON: { ok: true, status: 200, jsonThrows: true }, // 200 maintenance page
        DOWN: { networkError: true }, // fetch rejects
      }),
    );

    const prices = await provider.getQuotes(["VOO", "BADJSON", "DOWN"]);

    expect(prices.get("VOO")).toBe(500); // batch didn't fail-fast
    expect(prices.has("BADJSON")).toBe(false);
    expect(prices.has("DOWN")).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("BADJSON"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("DOWN"));
  });

  it("sends the API key as an Authorization: Token header", async () => {
    const fetchImpl = vi.fn(fakeFetch({ VOO: { body: [{ close: 500 }] } }));
    const provider = new TiingoPriceProvider("secret-key", fetchImpl as unknown as typeof fetch);

    await provider.getQuotes(["VOO"]);

    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Token secret-key");
  });

  it("throws when the API key is missing but tickers are requested", async () => {
    const provider = new TiingoPriceProvider(undefined, fakeFetch({}));
    await expect(provider.getQuotes(["VOO"])).rejects.toThrow(/TIINGO_API_KEY/);
  });

  it("makes no request (and needs no key) for an empty ticker list", async () => {
    const fetchImpl = vi.fn(fakeFetch({}));
    const provider = new TiingoPriceProvider(undefined, fetchImpl);
    expect((await provider.getQuotes([])).size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
