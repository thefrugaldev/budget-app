import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";
import { resetDeletionFilter } from "./reset-filter";

describe("resetDeletionFilter (pure)", () => {
  it("spares imported docs by default", () => {
    expect(resetDeletionFilter(false)).toEqual({ importRef: { $exists: false } });
  });

  it("clears everything when imported history is opted in", () => {
    expect(resetDeletionFilter(true)).toEqual({});
  });
});

// Integration: prove the filter, applied via a real household-scoped deleteMany,
// actually spares (default) or removes (opt-in) imported docs — story 14.
describe("resetDeletionFilter — applied to a real collection", () => {
  const HH = "hh1";
  let mongo: MemoryMongo;
  const coll = () =>
    mongo.db.collection<{ _id: string } & Record<string, unknown>>("transactions");

  beforeAll(async () => {
    mongo = await startMemoryMongo();
  }, 60_000);
  afterAll(async () => {
    await mongo?.stop();
  });
  afterEach(() => mongo.reset());

  async function seed() {
    await coll().insertMany([
      { _id: "manual1", householdId: HH, amount: 10, date: "2026-07-01" }, // hand-entered
      { _id: "imported1", householdId: HH, importRef: "2023.xlsx!2023!B2#1", amount: 52.1, date: "2023-01-03" },
    ]);
  }

  it("deletes only hand-entered docs by default, sparing imported history", async () => {
    await seed();
    await coll().deleteMany({
      householdId: HH,
      ...(resetDeletionFilter(false) as Record<string, unknown>),
    });

    expect(await coll().countDocuments({ _id: "manual1" })).toBe(0);
    expect(await coll().countDocuments({ _id: "imported1" })).toBe(1);
  });

  it("deletes imported history too when opted in", async () => {
    await seed();
    await coll().deleteMany({
      householdId: HH,
      ...(resetDeletionFilter(true) as Record<string, unknown>),
    });

    expect(await coll().countDocuments({ householdId: HH })).toBe(0);
  });

  // Net Worth collections joined the reset in chunk 7 (spec item 10). The filter
  // is collection-agnostic; prove it spares/removes imported docs there too.
  it("spares imported accounts and snapshots by default, removes them on opt-in", async () => {
    const accounts = mongo.db.collection<{ _id: string } & Record<string, unknown>>("accounts");
    const snapshots = mongo.db.collection<{ _id: string } & Record<string, unknown>>("snapshots");
    await accounts.insertMany([
      { _id: "acct-manual", householdId: HH, name: "Checking", class: "asset" },
      { _id: "acct-imported", householdId: HH, importRef: "liability!account!Mortgage", name: "Mortgage", class: "liability" },
    ]);
    await snapshots.insertMany([
      { _id: "snap-manual", householdId: HH, accountId: "acct-manual", date: "2026-07-01", value: 100 },
      { _id: "snap-imported", householdId: HH, importRef: "2023.xlsx!DebtsEquity!B2#1", accountId: "acct-imported", date: "2023-01-31", value: 300000 },
    ]);

    const spare = { householdId: HH, ...(resetDeletionFilter(false) as Record<string, unknown>) };
    await accounts.deleteMany(spare);
    await snapshots.deleteMany(spare);
    expect(await accounts.countDocuments({ _id: "acct-imported" })).toBe(1);
    expect(await snapshots.countDocuments({ _id: "snap-imported" })).toBe(1);
    expect(await accounts.countDocuments({ _id: "acct-manual" })).toBe(0);

    const all = { householdId: HH, ...(resetDeletionFilter(true) as Record<string, unknown>) };
    await accounts.deleteMany(all);
    await snapshots.deleteMany(all);
    expect(await accounts.countDocuments({ householdId: HH })).toBe(0);
    expect(await snapshots.countDocuments({ householdId: HH })).toBe(0);
  });
});
