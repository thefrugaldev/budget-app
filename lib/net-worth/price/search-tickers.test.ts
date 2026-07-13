import { describe, expect, it, vi } from "vitest";

import type { TickerSearchProvider, TickerSearchResult } from "@/types/net-worth";

import { MAX_SEARCH_RESULTS, MIN_SEARCH_LENGTH, searchTickers } from "./search-tickers";

const fakeProvider = (results: TickerSearchResult[]): TickerSearchProvider => ({
  search: vi.fn(async () => results),
});

describe("searchTickers", () => {
  it("returns nothing (and never calls the provider) below the minimum query length", async () => {
    const provider = fakeProvider([{ symbol: "A", description: "A co" }]);
    const short = "x".repeat(MIN_SEARCH_LENGTH - 1);
    expect(await searchTickers(short, provider)).toEqual([]);
    expect(provider.search).not.toHaveBeenCalled();
  });

  it("caps the result list to keep the combobox scannable", async () => {
    const many = Array.from({ length: MAX_SEARCH_RESULTS + 5 }, (_, i) => ({
      symbol: `SYM${i}`,
      description: `Company ${i}`,
    }));
    const results = await searchTickers("apple", fakeProvider(many));
    expect(results).toHaveLength(MAX_SEARCH_RESULTS);
    expect(results[0]).toEqual({ symbol: "SYM0", description: "Company 0" });
  });
});
