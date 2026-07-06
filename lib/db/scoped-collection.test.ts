import type { Collection } from "mongodb";
import { describe, expect, it } from "vitest";

import { ScopedCollection } from "./scoped-collection";

type TestDoc = {
  _id: string;
  householdId?: string;
  categoryId?: string;
  amount?: number;
};

type RecordedCall = { method: string; args: unknown[] };

// A Collection test double that records the arguments each method receives.
// The ScopedCollection only forwards to these methods, so inspecting the
// recorded args is enough to prove it scopes/stamps correctly — no real driver.
function mockCollection(): {
  collection: Collection<TestDoc>;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return { toArray: async () => [] };
    };
  const collection = {
    find: record("find"),
    findOne: record("findOne"),
    countDocuments: record("countDocuments"),
    aggregate: record("aggregate"),
    insertOne: record("insertOne"),
    insertMany: record("insertMany"),
    updateOne: record("updateOne"),
    updateMany: record("updateMany"),
    deleteOne: record("deleteOne"),
    deleteMany: record("deleteMany"),
  } as unknown as Collection<TestDoc>;
  return { collection, calls };
}

const HH = "household-1";

describe("ScopedCollection", () => {
  it("merges the household into a find filter", () => {
    const { collection, calls } = mockCollection();
    new ScopedCollection<TestDoc>(collection, HH).find({ categoryId: "c" });
    expect(calls[0]).toEqual({
      method: "find",
      args: [{ categoryId: "c", householdId: HH }],
    });
  });

  it("scopes an argument-less find to the household", () => {
    const { collection, calls } = mockCollection();
    new ScopedCollection<TestDoc>(collection, HH).find();
    expect(calls[0].args[0]).toEqual({ householdId: HH });
  });

  it("scopes findOne and countDocuments", () => {
    const { collection, calls } = mockCollection();
    const scoped = new ScopedCollection<TestDoc>(collection, HH);
    scoped.findOne({ _id: "x" });
    scoped.countDocuments({ categoryId: "c" });
    expect(calls[0].args[0]).toEqual({ _id: "x", householdId: HH });
    expect(calls[1].args[0]).toEqual({ categoryId: "c", householdId: HH });
  });

  it("stamps the household on insertOne", () => {
    const { collection, calls } = mockCollection();
    new ScopedCollection<TestDoc>(collection, HH).insertOne({ _id: "x" });
    expect(calls[0].args[0]).toEqual({ _id: "x", householdId: HH });
  });

  it("stamps the household on every insertMany document", () => {
    const { collection, calls } = mockCollection();
    new ScopedCollection<TestDoc>(collection, HH).insertMany([
      { _id: "a" },
      { _id: "b" },
    ]);
    expect(calls[0].args[0]).toEqual([
      { _id: "a", householdId: HH },
      { _id: "b", householdId: HH },
    ]);
  });

  it("scopes the filter but forwards the update and options untouched", () => {
    const { collection, calls } = mockCollection();
    new ScopedCollection<TestDoc>(collection, HH).updateOne(
      { _id: "x" },
      { $set: { amount: 1 } },
      { upsert: true },
    );
    expect(calls[0].args).toEqual([
      { _id: "x", householdId: HH },
      { $set: { amount: 1 } },
      { upsert: true },
    ]);
  });

  it("scopes updateMany, deleteOne, and deleteMany filters", () => {
    const { collection, calls } = mockCollection();
    const scoped = new ScopedCollection<TestDoc>(collection, HH);
    scoped.updateMany({ categoryId: "c" }, { $set: { amount: 2 } });
    scoped.deleteOne({ _id: "x" });
    scoped.deleteMany({ categoryId: "c" });
    expect(calls[0].args[0]).toEqual({ categoryId: "c", householdId: HH });
    expect(calls[1].args[0]).toEqual({ _id: "x", householdId: HH });
    expect(calls[2].args[0]).toEqual({ categoryId: "c", householdId: HH });
  });

  it("scopes an argument-less deleteMany (the reset path)", () => {
    const { collection, calls } = mockCollection();
    new ScopedCollection<TestDoc>(collection, HH).deleteMany();
    expect(calls[0].args[0]).toEqual({ householdId: HH });
  });

  it("prefixes a household $match onto aggregate pipelines", () => {
    const { collection, calls } = mockCollection();
    new ScopedCollection<TestDoc>(collection, HH).aggregate([
      { $group: { _id: "$categoryId" } },
    ]);
    expect(calls[0].args[0]).toEqual([
      { $match: { householdId: HH } },
      { $group: { _id: "$categoryId" } },
    ]);
  });
});
