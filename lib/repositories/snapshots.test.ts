import type { Document } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ScopedCollection } from "@/lib/db/scoped-collection";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";

vi.mock("@/lib/db/household-scope", () => ({ scopedCollection: vi.fn() }));

import { scopedCollection } from "@/lib/db/household-scope";

import {
  countSnapshotsForAccount,
  createSnapshot,
  deleteSnapshotsForAccount,
  listSnapshots,
  listSnapshotsForAccount,
} from "./snapshots";

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

describe("snapshots repository", () => {
  it("creates a snapshot and stamps the household", async () => {
    const snap = await createSnapshot({ accountId: "a1", date: "2026-01-31", value: 1_234.56 });
    expect(snap).toEqual({ accountId: "a1", date: "2026-01-31", value: 1_234.56 });
    const raw = await mongo.db.collection("snapshots").findOne({ accountId: "a1" });
    expect(raw?.householdId).toBe(HH);
  });

  it("rejects a negative value and a malformed date at the write boundary", async () => {
    await expect(createSnapshot({ accountId: "a1", date: "2026-01-31", value: -1 })).rejects.toThrow(
      /non-negative magnitude/,
    );
    await expect(
      createSnapshot({ accountId: "a1", date: "2026-02-30", value: 1 }),
    ).rejects.toThrow(/not a real calendar date/);
  });

  it("lists snapshots in date order, household-wide and per account", async () => {
    await createSnapshot({ accountId: "a1", date: "2026-03-31", value: 3 });
    await createSnapshot({ accountId: "a1", date: "2026-01-31", value: 1 });
    await createSnapshot({ accountId: "a2", date: "2026-02-28", value: 2 });

    expect((await listSnapshots()).map((s) => s.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect((await listSnapshotsForAccount("a1")).map((s) => s.value)).toEqual([1, 3]);
  });

  it("counts and deletes an account's snapshots", async () => {
    await createSnapshot({ accountId: "a1", date: "2026-01-31", value: 1 });
    await createSnapshot({ accountId: "a1", date: "2026-02-28", value: 2 });
    await createSnapshot({ accountId: "a2", date: "2026-02-28", value: 9 });

    expect(await countSnapshotsForAccount("a1")).toBe(2);
    expect(await deleteSnapshotsForAccount("a1")).toBe(2);
    expect(await countSnapshotsForAccount("a1")).toBe(0);
    expect(await countSnapshotsForAccount("a2")).toBe(1); // untouched
  });
});
