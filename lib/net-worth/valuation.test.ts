import { describe, expect, it } from "vitest";

import type { Account, PriceLookup } from "@/types/net-worth";

import { accountValue, nestEgg, netWorthHeadline, signedContribution } from "./valuation";

const prices: Record<string, number> = { VOO: 500, AAPL: 200 };
const priceFor: PriceLookup = (ticker) => prices[ticker];

function account(over: Partial<Account> & Pick<Account, "class">): Account {
  return { id: over.id ?? "a", name: over.name ?? "Acct", ...over };
}

describe("accountValue", () => {
  it("returns the manual balance for cash / property / liability accounts", () => {
    expect(accountValue(account({ class: "asset", kind: "cash", balance: 12_000 }), priceFor)).toBe(12_000);
    expect(accountValue(account({ class: "asset", kind: "property", balance: 450_000 }), priceFor)).toBe(450_000);
    expect(accountValue(account({ class: "liability", balance: 300_000 }), priceFor)).toBe(300_000);
  });

  it("values an investment account as Σ(quantity × price)", () => {
    const brokerage = account({
      class: "asset",
      kind: "investment",
      holdings: [
        { ticker: "VOO", quantity: 10 }, // 5_000
        { ticker: "AAPL", quantity: 3 }, // 600
      ],
    });
    expect(accountValue(brokerage, priceFor)).toBe(5_600);
  });

  it("treats a holding with no resolvable price as 0 — never invents a price", () => {
    const brokerage = account({
      class: "asset",
      kind: "investment",
      holdings: [
        { ticker: "VOO", quantity: 10 }, // 5_000
        { ticker: "MYSTERY", quantity: 99 }, // unpriced → 0
      ],
    });
    expect(accountValue(brokerage, priceFor)).toBe(5_000);
  });

  it("is 0 for an investment account with no holdings and a balance-less account", () => {
    expect(accountValue(account({ class: "asset", kind: "investment" }), priceFor)).toBe(0);
    expect(accountValue(account({ class: "asset", kind: "cash" }), priceFor)).toBe(0);
  });
});

describe("signedContribution", () => {
  it("adds assets and subtracts liabilities", () => {
    expect(signedContribution("asset", 100)).toBe(100);
    expect(signedContribution("liability", 100)).toBe(-100);
  });
});

describe("netWorthHeadline", () => {
  const accounts: Account[] = [
    account({ id: "hysa", class: "asset", kind: "cash", balance: 20_000 }),
    account({
      id: "brk",
      class: "asset",
      kind: "investment",
      holdings: [{ ticker: "VOO", quantity: 100 }], // 50_000
    }),
    account({ id: "house", class: "asset", kind: "property", balance: 450_000 }),
    account({ id: "mortgage", class: "liability", balance: 300_000 }),
  ];

  it("splits assets and liabilities and nets them", () => {
    expect(netWorthHeadline(accounts, priceFor)).toEqual({
      assets: 520_000,
      liabilities: 300_000,
      net: 220_000,
    });
  });

  it("excludes closed accounts from every subtotal", () => {
    const withClosed = [
      ...accounts,
      account({ id: "old", class: "asset", kind: "cash", balance: 9_999, closedAt: "2025-01-31" }),
    ];
    expect(netWorthHeadline(withClosed, priceFor)).toEqual(netWorthHeadline(accounts, priceFor));
  });
});

describe("nestEgg", () => {
  it("sums cash + investment assets, excluding property and liabilities", () => {
    const accounts: Account[] = [
      account({ id: "hysa", class: "asset", kind: "cash", balance: 20_000 }),
      account({
        id: "brk",
        class: "asset",
        kind: "investment",
        holdings: [{ ticker: "VOO", quantity: 100 }], // 50_000
      }),
      account({ id: "house", class: "asset", kind: "property", balance: 450_000 }),
      account({ id: "mortgage", class: "liability", balance: 300_000 }),
    ];
    expect(nestEgg(accounts, priceFor)).toBe(70_000);
  });

  it("excludes closed accounts", () => {
    const accounts: Account[] = [
      account({ id: "hysa", class: "asset", kind: "cash", balance: 20_000 }),
      account({ id: "closed", class: "asset", kind: "investment", holdings: [{ ticker: "VOO", quantity: 10 }], closedAt: "2025-06-30" }),
    ];
    expect(nestEgg(accounts, priceFor)).toBe(20_000);
  });
});
