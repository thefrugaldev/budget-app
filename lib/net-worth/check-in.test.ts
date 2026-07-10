import { describe, expect, it } from "vitest";

import type { Account, PriceLookup } from "@/types/net-worth";

import { buildCheckInSnapshots, tickersNeedingQuotes } from "./check-in";

const prices: Record<string, number> = { VTI: 100, AAPL: 200 };
const priceFor: PriceLookup = (t) => prices[t];

function account(partial: Partial<Account> & Pick<Account, "id" | "class">): Account {
  return { name: partial.id, ...partial };
}

describe("buildCheckInSnapshots", () => {
  it("records a balance account's value and its balance composition", () => {
    const cash = account({ id: "c", class: "asset", kind: "cash", balance: 4200 });
    expect(buildCheckInSnapshots([cash], priceFor, "2026-07-10")).toEqual([
      { accountId: "c", date: "2026-07-10", value: 4200, composition: { balance: 4200 } },
    ]);
  });

  it("records an investment account as holdings × price, matching the value", () => {
    const brokerage = account({
      id: "b",
      class: "asset",
      kind: "investment",
      holdings: [
        { ticker: "VTI", quantity: 10 },
        { ticker: "AAPL", quantity: 2 },
      ],
    });
    const [snap] = buildCheckInSnapshots([brokerage], priceFor, "2026-07-10");
    // 10×100 + 2×200 = 1400.
    expect(snap.value).toBe(1400);
    expect(snap.composition).toEqual({
      holdings: [
        { ticker: "VTI", quantity: 10, price: 100 },
        { ticker: "AAPL", quantity: 2, price: 200 },
      ],
    });
    // The recorded composition reconstructs the recorded value exactly.
    const restated = snap.composition as { holdings: { quantity: number; price: number }[] };
    expect(restated.holdings.reduce((s, h) => s + h.quantity * h.price, 0)).toBe(snap.value);
  });

  it("prefers a manual override over the feed price in both value and composition", () => {
    const brokerage = account({
      id: "b",
      class: "asset",
      kind: "investment",
      holdings: [{ ticker: "VTI", quantity: 10, priceOverride: 150 }],
    });
    const [snap] = buildCheckInSnapshots([brokerage], priceFor, "2026-07-10");
    expect(snap.value).toBe(1500);
    expect(snap.composition).toEqual({ holdings: [{ ticker: "VTI", quantity: 10, price: 150 }] });
  });

  it("records an unpriced holding at price 0 so value and composition still agree", () => {
    const brokerage = account({
      id: "b",
      class: "asset",
      kind: "investment",
      holdings: [{ ticker: "MYSTERY", quantity: 5 }],
    });
    const [snap] = buildCheckInSnapshots([brokerage], priceFor, "2026-07-10");
    expect(snap.value).toBe(0);
    expect(snap.composition).toEqual({ holdings: [{ ticker: "MYSTERY", quantity: 5, price: 0 }] });
  });

  it("records a liability's balance (magnitude — sign is applied in aggregation)", () => {
    const mortgage = account({ id: "m", class: "liability", balance: 300000 });
    expect(buildCheckInSnapshots([mortgage], priceFor, "2026-07-10")).toEqual([
      { accountId: "m", date: "2026-07-10", value: 300000, composition: { balance: 300000 } },
    ]);
  });

  it("skips closed accounts — they already recorded a final zero snapshot", () => {
    const open = account({ id: "o", class: "asset", kind: "cash", balance: 10 });
    const closed = account({ id: "x", class: "asset", kind: "cash", balance: 0, closedAt: "2026-06-01" });
    const snaps = buildCheckInSnapshots([open, closed], priceFor, "2026-07-10");
    expect(snaps.map((s) => s.accountId)).toEqual(["o"]);
  });

  it("records every open account so a month is a complete data point", () => {
    const a = account({ id: "a", class: "asset", kind: "cash", balance: 1 });
    const b = account({ id: "b", class: "asset", kind: "property", balance: 2 });
    const c = account({ id: "c", class: "liability", balance: 3 });
    expect(buildCheckInSnapshots([a, b, c], priceFor, "2026-07-10").map((s) => s.accountId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("treats a balance account with no balance as zero", () => {
    const cash = account({ id: "c", class: "asset", kind: "cash" });
    const [snap] = buildCheckInSnapshots([cash], priceFor, "2026-07-10");
    expect(snap.value).toBe(0);
    expect(snap.composition).toEqual({ balance: 0 });
  });
});

describe("tickersNeedingQuotes", () => {
  it("collects distinct tickers from open investment accounts", () => {
    const one = account({
      id: "1",
      class: "asset",
      kind: "investment",
      holdings: [{ ticker: "VTI", quantity: 1 }, { ticker: "AAPL", quantity: 1 }],
    });
    const two = account({
      id: "2",
      class: "asset",
      kind: "investment",
      holdings: [{ ticker: "VTI", quantity: 1 }],
    });
    expect(tickersNeedingQuotes([one, two]).sort()).toEqual(["AAPL", "VTI"]);
  });

  it("omits holdings with a manual override — they need no quote", () => {
    const acct = account({
      id: "1",
      class: "asset",
      kind: "investment",
      holdings: [
        { ticker: "VTI", quantity: 1 },
        { ticker: "OVR", quantity: 1, priceOverride: 5 },
      ],
    });
    expect(tickersNeedingQuotes([acct])).toEqual(["VTI"]);
  });

  it("ignores closed accounts and non-investment kinds", () => {
    const cash = account({ id: "c", class: "asset", kind: "cash", balance: 1 });
    const closed = account({
      id: "x",
      class: "asset",
      kind: "investment",
      holdings: [{ ticker: "GONE", quantity: 1 }],
      closedAt: "2026-06-01",
    });
    expect(tickersNeedingQuotes([cash, closed])).toEqual([]);
  });
});
