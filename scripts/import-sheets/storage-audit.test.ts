import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";
import { auditStorage, projectStorage, type CollectionStat } from "./storage-audit";

const GIB = 1024 ** 3;

function stat(name: string, over: Partial<CollectionStat> = {}): CollectionStat {
  return { name, count: 0, avgDocBytes: 0, dataBytes: 0, indexBytes: 0, ...over };
}

describe("projectStorage (pure)", () => {
  it("projects years of headroom from the observed transactions-per-year rate", () => {
    // 7000 txns over 7 years = 1000/yr; the collection footprint is
    // 700_000 data + 300_000 index = 1_000_000 bytes → 1000 B/txn → 1 MB/yr.
    const p = projectStorage({
      collections: [
        stat("transactions", { count: 7000, dataBytes: 700_000, indexBytes: 300_000 }),
        stat("categories", { count: 100, dataBytes: 50_000, indexBytes: 20_000 }),
      ],
      capBytes: 25 * GIB,
      transactionCount: 7000,
      firstYear: 2020,
      lastYear: 2026,
    });

    expect(p.usedBytes).toBe(1_070_000);
    expect(p.freeBytes).toBe(25 * GIB - 1_070_000);
    expect(p.bytesPerTransaction).toBeCloseTo(1_000 / 7, 6); // footprint / count
    expect(p.transactionsPerYear).toBe(1000);
    expect(p.bytesPerYear).toBeCloseTo((1000 * 1_000_000) / 7000, 3); // ≈ 142_857 B/yr
    // freeBytes / bytesPerYear — comfortably huge on a 25 GiB tier.
    expect(p.yearsOfHeadroom).toBeCloseTo(p.freeBytes / (p.bytesPerYear as number), 3);
    expect(p.yearsOfHeadroom as number).toBeGreaterThan(100_000);
  });

  it("treats a single year of data as a one-year span (no divide-by-zero)", () => {
    const p = projectStorage({
      collections: [stat("transactions", { count: 500, dataBytes: 100_000, indexBytes: 0 })],
      capBytes: 1 * GIB,
      transactionCount: 500,
      firstYear: 2026,
      lastYear: 2026,
    });
    expect(p.transactionsPerYear).toBe(500);
    expect(p.bytesPerYear).toBe(100_000);
  });

  it("returns null projections when there are no transactions", () => {
    const p = projectStorage({
      collections: [stat("categories", { count: 10, dataBytes: 4_000 })],
      capBytes: 1 * GIB,
      transactionCount: 0,
      firstYear: null,
      lastYear: null,
    });
    expect(p.transactionsPerYear).toBeNull();
    expect(p.bytesPerYear).toBeNull();
    expect(p.yearsOfHeadroom).toBeNull();
    expect(p.usedBytes).toBe(4_000);
  });

  it("never reports negative free space once the cap is exceeded", () => {
    const p = projectStorage({
      collections: [stat("transactions", { count: 1, dataBytes: 2 * GIB, indexBytes: 0 })],
      capBytes: 1 * GIB,
      transactionCount: 1,
      firstYear: 2026,
      lastYear: 2026,
    });
    expect(p.freeBytes).toBe(0);
    expect(p.usedFraction).toBeGreaterThan(1);
    expect(p.yearsOfHeadroom).toBe(0);
  });
});

// Integration: prove auditStorage reads real collection stats and the observed
// transaction span off a live (disposable) database.
describe("auditStorage — against a real database", () => {
  let mongo: MemoryMongo;
  beforeAll(async () => {
    mongo = await startMemoryMongo();
  }, 60_000);
  afterAll(async () => {
    await mongo?.stop();
  });
  beforeEach(() => mongo.reset());

  // Collections keyed by string `_id` (the app's convention), so inserts don't
  // trip the driver's default ObjectId `_id` typing.
  const coll = (name: string) =>
    mongo.db.collection<{ _id: string } & Record<string, unknown>>(name);

  it("counts transactions and derives the year span from real docs", async () => {
    await coll("transactions").insertMany([
      { _id: "t1", categoryId: "c", amount: 10, date: "2021-03-04", createdAt: new Date() },
      { _id: "t2", categoryId: "c", amount: 20, date: "2024-11-30", createdAt: new Date() },
      { _id: "t3", categoryId: "c", amount: 30, date: "2026-01-15", createdAt: new Date() },
    ]);
    await coll("categories").insertOne({
      _id: "c",
      name: "Groceries",
      kind: "expense",
      activeFrom: "2021-01",
      createdAt: new Date(),
    });

    const audit = await auditStorage({ db: mongo.db, capBytes: 25 * GIB });

    expect(audit.transactions).toEqual({ count: 3, firstYear: 2021, lastYear: 2026 });
    const txn = audit.collections.find((c) => c.name === "transactions");
    expect(txn?.count).toBe(3);
    expect(txn?.dataBytes).toBeGreaterThan(0);
    // 3 txns over a 2021–2026 (6y) span → 0.5/yr.
    expect(audit.projection.transactionsPerYear).toBeCloseTo(0.5, 6);
    expect(audit.projection.yearsOfHeadroom as number).toBeGreaterThan(0);
  });

  it("reports empty projections on a database with no transactions", async () => {
    await coll("categories").insertOne({
      _id: "c",
      name: "Rent",
      kind: "expense",
      activeFrom: "2026-01",
      createdAt: new Date(),
    });

    const audit = await auditStorage({ db: mongo.db, capBytes: 25 * GIB });

    expect(audit.transactions.count).toBe(0);
    expect(audit.projection.yearsOfHeadroom).toBeNull();
    // No transactions → the transactions collection contributes zero docs (or is
    // absent entirely, depending on the engine); either way it can't skew the
    // projection.
    const txn = audit.collections.find((c) => c.name === "transactions");
    expect(txn?.count ?? 0).toBe(0);
    expect(audit.collections.some((c) => c.name === "categories")).toBe(true);
  });
});
