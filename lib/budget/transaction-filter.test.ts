import { describe, expect, it } from "vitest";

import type { TransactionFilter } from "./transaction-filter";
import {
  applyTransactionFilterToParams,
  parseTransactionFilter,
  serializeTransactionFilter,
} from "./transaction-filter";

describe("transaction filter URL seam", () => {
  const full: TransactionFilter = {
    text: "coffee",
    vendor: "Blue Bottle",
    dateFrom: "2026-01-01",
    dateTo: "2026-03-31",
    categoryIds: ["dining", "groceries"],
  };

  it("round-trips a full filter through params and back", () => {
    const params = serializeTransactionFilter(full);
    expect(parseTransactionFilter(params)).toEqual(full);
  });

  it("serializes an empty filter to a clean (empty) URL", () => {
    expect(serializeTransactionFilter({}).toString()).toBe("");
    expect(serializeTransactionFilter({ text: "", vendor: "" }).toString()).toBe("");
    expect(serializeTransactionFilter({ categoryIds: [] }).toString()).toBe("");
  });

  it("parses an empty param set to an empty filter", () => {
    expect(parseTransactionFilter(new URLSearchParams())).toEqual({});
  });

  it("ignores unrelated params (e.g. range) when parsing", () => {
    const params = new URLSearchParams("range=ytd&q=coffee");
    expect(parseTransactionFilter(params)).toEqual({ text: "coffee" });
  });

  it("trims whitespace and drops blank text/vendor", () => {
    const params = serializeTransactionFilter({ text: "  tea  ", vendor: "   " });
    expect(params.get("q")).toBe("tea");
    expect(params.has("vendor")).toBe(false);
  });

  describe("applyTransactionFilterToParams", () => {
    it("preserves the range param while writing the filter", () => {
      const base = new URLSearchParams("range=ytd");
      const next = applyTransactionFilterToParams(base, { text: "coffee" });
      expect(next.get("range")).toBe("ytd");
      expect(next.get("q")).toBe("coffee");
    });

    it("clears stale filter keys when a field is emptied, keeping range", () => {
      const base = new URLSearchParams("range=ytd&q=coffee&vendor=Blue+Bottle");
      const next = applyTransactionFilterToParams(base, { text: "tea" });
      expect(next.get("range")).toBe("ytd");
      expect(next.get("q")).toBe("tea");
      expect(next.has("vendor")).toBe(false);
    });

    it("an empty filter leaves only the unrelated params", () => {
      const base = new URLSearchParams("range=ytd&q=coffee");
      const next = applyTransactionFilterToParams(base, {});
      expect(next.toString()).toBe("range=ytd");
    });
  });
});
