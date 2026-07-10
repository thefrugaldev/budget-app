import { describe, expect, it } from "vitest";

import { pricingStatus } from "./pricing-status";

const HOUR = 60 * 60 * 1000;
const TTL = 12 * HOUR;
const NOW = "2026-07-10T12:00:00.000Z";

describe("pricingStatus", () => {
  it("is clean when every needed ticker is freshly priced", () => {
    const status = pricingStatus({
      neededTickers: ["VTI", "AAPL"],
      prices: new Map([["VTI", 100], ["AAPL", 200]]),
      asOf: new Map([["VTI", NOW], ["AAPL", NOW]]),
      now: NOW,
      ttlMs: TTL,
    });
    expect(status).toEqual({ pricedAt: NOW, stale: false, unpriced: [] });
  });

  it("reports nothing to price when there are no needed tickers", () => {
    const status = pricingStatus({
      neededTickers: [],
      prices: new Map(),
      asOf: new Map(),
      now: NOW,
      ttlMs: TTL,
    });
    expect(status).toEqual({ pricedAt: null, stale: false, unpriced: [] });
  });

  it("flags stale when a priced ticker's timestamp is older than the TTL", () => {
    // 13h old > 12h TTL — the feed couldn't refresh, showing a cached value.
    const old = "2026-07-09T23:00:00.000Z";
    const status = pricingStatus({
      neededTickers: ["VTI"],
      prices: new Map([["VTI", 100]]),
      asOf: new Map([["VTI", old]]),
      now: NOW,
      ttlMs: TTL,
    });
    expect(status.stale).toBe(true);
    expect(status.pricedAt).toBe(old);
    expect(status.unpriced).toEqual([]);
  });

  it("collects tickers with no price at all as unpriced", () => {
    const status = pricingStatus({
      neededTickers: ["VTI", "MYSTERY"],
      prices: new Map([["VTI", 100]]),
      asOf: new Map([["VTI", NOW]]),
      now: NOW,
      ttlMs: TTL,
    });
    expect(status.unpriced).toEqual(["MYSTERY"]);
    expect(status.stale).toBe(false);
    expect(status.pricedAt).toBe(NOW);
  });

  it("reports the oldest asOf as pricedAt across a mixed set", () => {
    const older = "2026-07-10T06:00:00.000Z";
    const status = pricingStatus({
      neededTickers: ["VTI", "AAPL"],
      prices: new Map([["VTI", 100], ["AAPL", 200]]),
      asOf: new Map([["VTI", NOW], ["AAPL", older]]),
      now: NOW,
      ttlMs: TTL,
    });
    expect(status.pricedAt).toBe(older);
    expect(status.stale).toBe(false);
  });

  it("treats a priced ticker with a missing timestamp as stale", () => {
    const status = pricingStatus({
      neededTickers: ["VTI"],
      prices: new Map([["VTI", 100]]),
      asOf: new Map(),
      now: NOW,
      ttlMs: TTL,
    });
    expect(status.stale).toBe(true);
    expect(status.pricedAt).toBeNull();
  });
});
