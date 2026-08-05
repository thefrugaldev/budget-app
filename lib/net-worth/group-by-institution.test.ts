import { describe, expect, it } from "vitest";

import type { Account, PriceLookup } from "@/types/net-worth";

import { groupAccountsByInstitution } from "./group-by-institution";
import { netWorthHeadline } from "./valuation";

const prices: Record<string, number> = { VOO: 500, AAPL: 200 };
const priceFor: PriceLookup = (ticker) => prices[ticker];

function account(over: Partial<Account> & Pick<Account, "class">): Account {
  return { id: over.id ?? "a", name: over.name ?? "Acct", ...over };
}

describe("groupAccountsByInstitution", () => {
  it("returns no groups for an empty list", () => {
    expect(groupAccountsByInstitution([], priceFor)).toEqual([]);
  });

  it("collects multiple accounts at one institution into a single group and sums the subtotal", () => {
    const accounts = [
      account({ id: "1", class: "asset", kind: "cash", balance: 12_000, institution: "Ally" }),
      account({ id: "2", class: "asset", kind: "cash", balance: 8_000, institution: "Ally" }),
    ];

    const groups = groupAccountsByInstitution(accounts, priceFor);
    expect(groups).toHaveLength(1);
    expect(groups[0].institution).toBe("Ally");
    expect(groups[0].accounts.map((a) => a.id)).toEqual(["1", "2"]);
    expect(groups[0].subtotal).toBe(20_000);
  });

  it("derives subtotals from accountValue — holdings valued at price, balances taken as-is", () => {
    const accounts = [
      account({
        id: "brok",
        class: "asset",
        kind: "investment",
        institution: "Vanguard",
        holdings: [
          { ticker: "VOO", quantity: 10 }, // 5_000
          { ticker: "AAPL", quantity: 3 }, // 600
        ],
      }),
      account({ id: "hysa", class: "asset", kind: "cash", balance: 1_400, institution: "Vanguard" }),
    ];

    const [group] = groupAccountsByInstitution(accounts, priceFor);
    expect(group.institution).toBe("Vanguard");
    expect(group.subtotal).toBe(7_000); // 5_600 holdings + 1_400 balance
  });

  it("puts accounts with no institution into a single null-keyed bucket", () => {
    const accounts = [
      account({ id: "1", class: "asset", kind: "cash", balance: 5_000 }), // undefined institution
      account({ id: "2", class: "asset", kind: "cash", balance: 3_000, institution: "   " }), // blank
      account({ id: "3", class: "asset", kind: "cash", balance: 1_000, institution: "" }), // empty
    ];

    const groups = groupAccountsByInstitution(accounts, priceFor);
    expect(groups).toHaveLength(1);
    expect(groups[0].institution).toBeNull();
    expect(groups[0].accounts.map((a) => a.id)).toEqual(["1", "2", "3"]);
    expect(groups[0].subtotal).toBe(9_000);
  });

  it("orders named institutions by subtotal magnitude, largest first", () => {
    const accounts = [
      account({ id: "sm", class: "asset", kind: "cash", balance: 1_000, institution: "Small Bank" }),
      account({ id: "big", class: "asset", kind: "cash", balance: 500_000, institution: "Big Bank" }),
      account({ id: "mid", class: "asset", kind: "cash", balance: 50_000, institution: "Mid Bank" }),
    ];

    expect(groupAccountsByInstitution(accounts, priceFor).map((g) => g.institution)).toEqual([
      "Big Bank",
      "Mid Bank",
      "Small Bank",
    ]);
  });

  it("keeps the 'No institution' bucket last even when its subtotal is the largest", () => {
    const accounts = [
      account({ id: "none", class: "asset", kind: "cash", balance: 999_999 }), // biggest, but unset
      account({ id: "v", class: "asset", kind: "cash", balance: 10, institution: "Vanguard" }),
    ];

    const groups = groupAccountsByInstitution(accounts, priceFor);
    expect(groups.map((g) => g.institution)).toEqual(["Vanguard", null]);
  });

  it("breaks a subtotal tie case-insensitively by name for a stable order", () => {
    const accounts = [
      account({ id: "z", class: "asset", kind: "cash", balance: 100, institution: "zebra" }),
      account({ id: "a", class: "asset", kind: "cash", balance: 100, institution: "Ally" }),
    ];

    expect(groupAccountsByInstitution(accounts, priceFor).map((g) => g.institution)).toEqual([
      "Ally",
      "zebra",
    ]);
  });

  it("groups purely by institution across mixed asset/liability inputs", () => {
    // A bank that holds both a checking asset and a mortgage liability: passed a
    // mixed list, the helper groups both under the one institution (the caller
    // splits by section in practice; the helper doesn't second-guess it).
    const accounts = [
      account({ id: "chk", class: "asset", kind: "cash", balance: 4_000, institution: "Chase" }),
      account({ id: "mtg", class: "liability", balance: 250_000, institution: "Chase" }),
      account({ id: "card", class: "liability", balance: 1_500, institution: "Amex" }),
    ];

    const groups = groupAccountsByInstitution(accounts, priceFor);
    expect(groups.map((g) => g.institution)).toEqual(["Chase", "Amex"]);
    const chase = groups.find((g) => g.institution === "Chase")!;
    expect(chase.accounts.map((a) => a.id)).toEqual(["chk", "mtg"]);
    // Subtotal is a plain magnitude sum — the caller applies signing per section.
    expect(chase.subtotal).toBe(254_000);
  });
});

// The Net Worth page's caller contract (chunk 5): it groups the *open, single-
// class* accounts per section, so the institution subtotals must reconcile with
// the headline totals the same accounts produce. This locks that — the helper
// doesn't drop closed accounts, so the page filters them before grouping.
describe("section-total invariant (Net Worth page caller contract)", () => {
  const accounts = [
    account({ id: "brok", class: "asset", kind: "investment", institution: "Vanguard", holdings: [{ ticker: "VOO", quantity: 10 }] }), // 5_000
    account({ id: "hysa", class: "asset", kind: "cash", balance: 20_000, institution: "Ally" }),
    account({ id: "529", class: "asset", kind: "cash", balance: 3_000 }), // no institution
    account({ id: "mtg", class: "liability", balance: 180_000, institution: "Chase" }),
    account({ id: "card", class: "liability", balance: 1_200 }), // no institution
    // A closed account the page filters out before grouping (headline drops it too).
    account({ id: "old", class: "asset", kind: "cash", balance: 999_999, institution: "Ghost", closedAt: "2024-01-01" }),
  ];
  const open = accounts.filter((a) => !a.closedAt);
  const headline = netWorthHeadline(accounts, priceFor);

  it("asset institution subtotals sum to the headline asset total", () => {
    const groups = groupAccountsByInstitution(open.filter((a) => a.class === "asset"), priceFor);
    expect(groups.reduce((sum, g) => sum + g.subtotal, 0)).toBe(headline.assets);
  });

  it("liability institution subtotals sum to the headline liability total", () => {
    const groups = groupAccountsByInstitution(open.filter((a) => a.class === "liability"), priceFor);
    expect(groups.reduce((sum, g) => sum + g.subtotal, 0)).toBe(headline.liabilities);
  });
});
