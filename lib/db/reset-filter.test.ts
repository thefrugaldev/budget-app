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
});
