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
    vendors: ["Blue Bottle", "Costco"],
    dateFrom: "2026-01-01",
    dateTo: "2026-03-31",
    categoryIds: ["dining", "groceries"],
    kinds: ["expense", "savings"],
    provenance: "imported",
  };

  it("round-trips a full filter through params and back", () => {
    const params = serializeTransactionFilter(full);
    expect(parseTransactionFilter(params)).toEqual(full);
  });

  it("serializes an empty filter to a clean (empty) URL", () => {
    expect(serializeTransactionFilter({}).toString()).toBe("");
    expect(serializeTransactionFilter({ text: "", vendors: [] }).toString()).toBe("");
    expect(serializeTransactionFilter({ categoryIds: [] }).toString()).toBe("");
  });

  it("parses an empty param set to an empty filter", () => {
    expect(parseTransactionFilter(new URLSearchParams())).toEqual({});
  });

  it("ignores unrelated params (e.g. range) when parsing", () => {
    const params = new URLSearchParams("range=ytd&q=coffee");
    expect(parseTransactionFilter(params)).toEqual({ text: "coffee" });
  });

  it("trims whitespace and drops blank text", () => {
    const params = serializeTransactionFilter({ text: "  tea  " });
    expect(params.get("q")).toBe("tea");
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

  describe("provenance axis", () => {
    it("round-trips imported / manual through params", () => {
      for (const provenance of ["imported", "manual"] as const) {
        const params = serializeTransactionFilter({ provenance });
        expect(params.get("src")).toBe(provenance);
        expect(parseTransactionFilter(params)).toEqual({ provenance });
      }
    });

    it("drops an unknown provenance value from the URL", () => {
      expect(parseTransactionFilter(new URLSearchParams("src=bogus"))).toEqual({});
    });

    it("emits nothing for the All state (undefined provenance)", () => {
      expect(serializeTransactionFilter({ provenance: undefined }).toString()).toBe("");
    });
  });

  describe("vendors axis", () => {
    it("emits one repeated vendor key per selection and round-trips it", () => {
      const params = serializeTransactionFilter({ vendors: ["Blue Bottle", "Costco"] });
      expect(params.getAll("vendor")).toEqual(["Blue Bottle", "Costco"]);
      expect(parseTransactionFilter(params)).toEqual({ vendors: ["Blue Bottle", "Costco"] });
    });

    it("round-trips a vendor containing a comma without splitting it", () => {
      const params = serializeTransactionFilter({ vendors: ["Smith, Jones LLC"] });
      expect(parseTransactionFilter(params)).toEqual({ vendors: ["Smith, Jones LLC"] });
    });

    it("round-trips the No-vendor sentinel as a bare vendor= param", () => {
      const params = serializeTransactionFilter({ vendors: [""] });
      expect(params.toString()).toBe("vendor=");
      expect(parseTransactionFilter(params)).toEqual({ vendors: [""] });
    });

    it("keeps a named vendor alongside the No-vendor sentinel", () => {
      const params = serializeTransactionFilter({ vendors: ["Costco", ""] });
      expect(parseTransactionFilter(params)).toEqual({ vendors: ["Costco", ""] });
    });

    it("dedupes repeated vendor keys when parsing", () => {
      expect(parseTransactionFilter(new URLSearchParams("vendor=Costco&vendor=Costco"))).toEqual({
        vendors: ["Costco"],
      });
    });

    it("serializes an empty vendors array to a clean URL", () => {
      expect(serializeTransactionFilter({ vendors: [] }).toString()).toBe("");
    });

    it("preserves multiple vendors through applyTransactionFilterToParams", () => {
      const base = new URLSearchParams("range=ytd");
      const next = applyTransactionFilterToParams(base, { vendors: ["Costco", ""] });
      expect(next.get("range")).toBe("ytd");
      expect(next.getAll("vendor")).toEqual(["Costco", ""]);
    });
  });
});

describe("matchesTransactionFilter — vendors axis", () => {
  const tx = (id: string, vendor?: string): Transaction => ({
    id,
    categoryId: "groceries",
    amount: 10,
    date: "2026-02-01",
    vendor,
  });

  it("keeps a row whose vendor is in the set (OR within the axis)", () => {
    const f: TransactionFilter = { vendors: ["Costco", "Blue Bottle"] };
    expect(matchesTransactionFilter(tx("a", "Costco"), f)).toBe(true);
    expect(matchesTransactionFilter(tx("b", "Blue Bottle"), f)).toBe(true);
    expect(matchesTransactionFilter(tx("c", "Trader Joe's"), f)).toBe(false);
  });

  it("matches any vendor when the set is empty/absent", () => {
    expect(matchesTransactionFilter(tx("a", "Costco"), {})).toBe(true);
    expect(matchesTransactionFilter(tx("a", "Costco"), { vendors: [] })).toBe(true);
  });

  it("the No-vendor sentinel matches only vendorless rows", () => {
    const f: TransactionFilter = { vendors: [""] };
    expect(matchesTransactionFilter(tx("a"), f)).toBe(true);
    expect(matchesTransactionFilter(tx("b", "   "), f)).toBe(true); // whitespace trims to no vendor
    expect(matchesTransactionFilter(tx("c", "Costco"), f)).toBe(false);
  });

  it("mixes a named vendor with No-vendor (either passes)", () => {
    const f: TransactionFilter = { vendors: ["Costco", ""] };
    expect(matchesTransactionFilter(tx("a", "Costco"), f)).toBe(true);
    expect(matchesTransactionFilter(tx("b"), f)).toBe(true);
    expect(matchesTransactionFilter(tx("c", "Blue Bottle"), f)).toBe(false);
  });

  it("normalises the row vendor before matching (trims)", () => {
    expect(matchesTransactionFilter(tx("a", "  Costco  "), { vendors: ["Costco"] })).toBe(true);
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

describe("matchesTransactionFilter — provenance axis", () => {
  const imported: Transaction = {
    id: "i1",
    categoryId: "hysa",
    amount: -500,
    date: "2026-02-01",
    imported: true,
  };
  const manual: Transaction = {
    id: "m1",
    categoryId: "hysa",
    amount: 20,
    date: "2026-02-02",
    imported: false,
  };

  it("keeps only imported rows when provenance is 'imported'", () => {
    expect(matchesTransactionFilter(imported, { provenance: "imported" })).toBe(true);
    expect(matchesTransactionFilter(manual, { provenance: "imported" })).toBe(false);
  });

  it("keeps only hand-entered rows when provenance is 'manual'", () => {
    expect(matchesTransactionFilter(manual, { provenance: "manual" })).toBe(true);
    expect(matchesTransactionFilter(imported, { provenance: "manual" })).toBe(false);
  });

  it("keeps both when provenance is undefined (All)", () => {
    expect(matchesTransactionFilter(imported, {})).toBe(true);
    expect(matchesTransactionFilter(manual, {})).toBe(true);
  });
});
