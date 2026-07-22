import type { Document } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ScopedCollection } from "@/lib/db/scoped-collection";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";

// Same seam-mock as the other repo tests: bind the real ScopedCollection to a
// disposable in-memory Mongo so we exercise the actual `$set`/`$unset` logic.
vi.mock("@/lib/db/household-scope", () => ({ scopedCollection: vi.fn() }));

import { scopedCollection } from "@/lib/db/household-scope";

import { createTransaction, updateTransaction } from "./transactions";

const HH = "hh-test";
let mongo: MemoryMongo;

beforeAll(async () => {
  mongo = await startMemoryMongo();
  vi.mocked(scopedCollection).mockImplementation(
    async <T extends { householdId?: string } & Document>(name: string) =>
      new ScopedCollection<T>(mongo.db.collection<T>(name), HH),
  );
}, 60_000);
afterAll(async () => {
  await mongo?.stop();
});
beforeEach(() => mongo.reset());

async function rawDoc(id: string) {
  return mongo.db
    .collection<{ _id: string } & Record<string, unknown>>("transactions")
    .findOne({ _id: id });
}

describe("updateTransaction — note clearing", () => {
  it("removes the note when patched with null (blanked in the edit form)", async () => {
    const tx = await createTransaction({
      categoryId: "cat-1",
      amount: -20,
      date: "2026-01-01",
      vendor: "St Albert",
      note: "Donation",
    });

    const hit = await updateTransaction(tx.id, { note: null });
    expect(hit).toBe(true);

    const raw = await rawDoc(tx.id);
    // The field is gone, not written as null/"" — a genuine `$unset`.
    expect(raw && "note" in raw).toBe(false);
    // Untouched sibling fields survive the partial patch.
    expect(raw?.vendor).toBe("St Albert");
    expect(raw?.amount).toBe(-20);
  });

  it("leaves the stored note untouched when the key is omitted", async () => {
    const tx = await createTransaction({
      categoryId: "cat-1",
      amount: -20,
      date: "2026-01-01",
      note: "keep me",
    });

    await updateTransaction(tx.id, { amount: -25 });

    const raw = await rawDoc(tx.id);
    expect(raw?.note).toBe("keep me");
    expect(raw?.amount).toBe(-25);
  });

  it("overwrites the note with a new value", async () => {
    const tx = await createTransaction({
      categoryId: "cat-1",
      amount: -20,
      date: "2026-01-01",
      note: "old",
    });

    await updateTransaction(tx.id, { note: "new" });

    expect((await rawDoc(tx.id))?.note).toBe("new");
  });

  it("returns false for a no-op patch (nothing to set or unset)", async () => {
    const tx = await createTransaction({
      categoryId: "cat-1",
      amount: -20,
      date: "2026-01-01",
    });

    expect(await updateTransaction(tx.id, {})).toBe(false);
  });
});
