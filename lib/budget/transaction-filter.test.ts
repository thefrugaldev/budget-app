import { describe, expect, it } from "vitest";

import type { Category, Transaction } from "@/types/budget";
import type { TransactionFilter } from "@/types/transaction";

import {
  applyTransactionFilterToParams,
  matchesTransactionFilter,
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
    kinds: ["expense", "savings"],
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

  describe("kinds axis", () => {
    it("serializes kinds and round-trips them back", () => {
      const params = serializeTransactionFilter({ kinds: ["savings", "income"] });
      expect(params.get("kind")).toBe("savings,income");
      expect(parseTransactionFilter(params)).toEqual({ kinds: ["savings", "income"] });
    });

    it("drops an unknown kind from the URL rather than trusting it", () => {
      const params = new URLSearchParams("kind=savings,bogus,income");
      expect(parseTransactionFilter(params)).toEqual({ kinds: ["savings", "income"] });
    });

    it("parses to no constraint when every kind is junk", () => {
      expect(parseTransactionFilter(new URLSearchParams("kind=bogus"))).toEqual({});
    });

    it("serializes an empty kinds array to a clean URL", () => {
      expect(serializeTransactionFilter({ kinds: [] }).toString()).toBe("");
    });
  });
});

describe("matchesTransactionFilter — kinds axis", () => {
  const categories: Category[] = [
    { id: "groceries", name: "Groceries", kind: "expense", activeFrom: "2026-01" },
    { id: "hysa", name: "HYSA", kind: "savings", activeFrom: "2026-01" },
    { id: "salary", name: "Salary", kind: "income", activeFrom: "2026-01" },
  ];
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const tx = (categoryId: string): Transaction => ({
    id: `t-${categoryId}`,
    categoryId,
    amount: 10,
    date: "2026-02-01",
  });

  it("keeps a row whose category kind is in the set", () => {
    expect(
      matchesTransactionFilter(tx("hysa"), { kinds: ["savings"] }, categoryById),
    ).toBe(true);
  });

  it("drops a row whose category kind is not in the set", () => {
    // groceries is expense, not savings
    expect(
      matchesTransactionFilter(tx("groceries"), { kinds: ["savings"] }, categoryById),
    ).toBe(false);
  });

  it("matches any kind when the set is empty/absent", () => {
    expect(matchesTransactionFilter(tx("groceries"), {}, categoryById)).toBe(true);
    expect(matchesTransactionFilter(tx("salary"), { kinds: [] }, categoryById)).toBe(true);
  });

  it("supports a multi-kind selection (savings OR income)", () => {
    const f: TransactionFilter = { kinds: ["savings", "income"] };
    expect(matchesTransactionFilter(tx("hysa"), f, categoryById)).toBe(true);
    expect(matchesTransactionFilter(tx("salary"), f, categoryById)).toBe(true);
    expect(matchesTransactionFilter(tx("groceries"), f, categoryById)).toBe(false);
  });

  it("excludes a row when its category can't be resolved and a kind is required", () => {
    expect(matchesTransactionFilter(tx("hysa"), { kinds: ["savings"] })).toBe(false);
    expect(
      matchesTransactionFilter(tx("orphan"), { kinds: ["savings"] }, categoryById),
    ).toBe(false);
  });
});
