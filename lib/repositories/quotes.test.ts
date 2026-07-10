import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";

// The quote cache is app-global, so it reaches Mongo via getDb (not
// scopedCollection). Mock just that seam onto a disposable in-memory Mongo.
vi.mock("@/lib/db/client", () => ({ getDb: vi.fn() }));

import { getDb } from "@/lib/db/client";

import { mongoQuoteCache } from "./quotes";

let mongo: MemoryMongo;

beforeAll(async () => {
  mongo = await startMemoryMongo();
  vi.mocked(getDb).mockResolvedValue(mongo.db);
}, 60_000);
afterAll(async () => {
  await mongo?.stop();
});
beforeEach(() => mongo.reset());

// Ticker-keyed collection (string `_id`), so raw assertions don't trip the
// driver's default ObjectId `_id` typing.
const quotes = () =>
  mongo.db.collection<{ _id: string } & Record<string, unknown>>("quotes");

describe("mongoQuoteCache", () => {
  it("writes then reads back the price and asOf (Date ↔ ISO round-trip)", async () => {
    await mongoQuoteCache.write([{ ticker: "VOO", price: 500.25, asOf: "2026-07-10T12:00:00.000Z" }]);

    const read = await mongoQuoteCache.read(["VOO"]);
    expect(read.get("VOO")).toEqual({ ticker: "VOO", price: 500.25, asOf: "2026-07-10T12:00:00.000Z" });
    // Stored as a BSON Date, keyed by ticker.
    const raw = await quotes().findOne({ _id: "VOO" });
    expect(raw?.asOf).toBeInstanceOf(Date);
  });

  it("upserts by ticker — a second write updates in place, no duplicate", async () => {
    await mongoQuoteCache.write([{ ticker: "VOO", price: 500, asOf: "2026-07-10T00:00:00.000Z" }]);
    await mongoQuoteCache.write([{ ticker: "VOO", price: 512, asOf: "2026-07-10T12:00:00.000Z" }]);

    expect(await quotes().countDocuments({ _id: "VOO" })).toBe(1);
    expect((await mongoQuoteCache.read(["VOO"])).get("VOO")?.price).toBe(512);
  });

  it("returns only the requested tickers", async () => {
    await mongoQuoteCache.write([
      { ticker: "VOO", price: 500, asOf: "2026-07-10T12:00:00.000Z" },
      { ticker: "AAPL", price: 200, asOf: "2026-07-10T12:00:00.000Z" },
    ]);

    const read = await mongoQuoteCache.read(["VOO"]);
    expect([...read.keys()]).toEqual(["VOO"]);
  });

  it("no-ops on empty read/write", async () => {
    await mongoQuoteCache.write([]);
    expect((await mongoQuoteCache.read([])).size).toBe(0);
    expect(await quotes().countDocuments()).toBe(0);
  });
});
