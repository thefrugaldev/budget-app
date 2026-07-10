import type { Document } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ScopedCollection } from "@/lib/db/scoped-collection";

import { startMemoryMongo, type MemoryMongo } from "../../test/memory-mongo";

// The one seam every household-owned repo reaches Mongo through. Mocking it
// (rather than the session + getDb + env chain behind it) binds the real
// ScopedCollection to a disposable in-memory Mongo, so these exercise the actual
// repository logic — including the update/close/delete edge cases — end to end.
vi.mock("@/lib/db/household-scope", () => ({ scopedCollection: vi.fn() }));

import { scopedCollection } from "@/lib/db/household-scope";

import {
  closeAccount,
  createAccount,
  deleteAccount,
  getAccountById,
  listAccounts,
  updateAccount,
} from "./accounts";
import { countSnapshotsForAccount, createSnapshot, listSnapshotsForAccount } from "./snapshots";

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

describe("accounts repository — create / read", () => {
  it("round-trips an account and stamps the household", async () => {
    const created = await createAccount({ name: "HYSA", class: "asset", kind: "cash", balance: 20_000 });
    expect(created).toMatchObject({ name: "HYSA", class: "asset", kind: "cash", balance: 20_000 });

    expect(await getAccountById(created.id)).toEqual(created);
    expect(await listAccounts()).toEqual([created]);
    // The domain object never carries householdId, but the stored doc does.
    const raw = await mongo.db
      .collection<{ _id: string } & Record<string, unknown>>("accounts")
      .findOne({ _id: created.id });
    expect(raw?.householdId).toBe(HH);
  });

  it("enforces the write-boundary invariants", async () => {
    await expect(createAccount({ name: "", class: "asset", kind: "cash" })).rejects.toThrow(
      /must not be empty/,
    );
    await expect(createAccount({ name: "Bad", class: "asset" })).rejects.toThrow(
      /asset account must have a kind/,
    );
    await expect(
      createAccount({ name: "Bad", class: "liability", kind: "cash" }),
    ).rejects.toThrow(/liability account must not have a kind/);
  });

  it("rejects an invalid holding on create and on update", async () => {
    await expect(
      createAccount({
        name: "Brokerage",
        class: "asset",
        kind: "investment",
        holdings: [{ ticker: "VOO", quantity: -3 }],
      }),
    ).rejects.toThrow(/quantity/);

    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });
    await expect(
      updateAccount(a.id, { holdings: [{ ticker: "VOO", quantity: 1, priceOverride: -1 }] }),
    ).rejects.toThrow(/price override/);
  });
});

describe("updateAccount", () => {
  it("renames and reports ok", async () => {
    const a = await createAccount({ name: "Old", class: "asset", kind: "cash", balance: 1 });
    expect(await updateAccount(a.id, { name: "New" })).toEqual({ ok: true });
    expect((await getAccountById(a.id))?.name).toBe("New");
  });

  it("distinguishes not-found from no-change", async () => {
    expect(await updateAccount("nope", { name: "x" })).toEqual({ ok: false, reason: "not-found" });
    const a = await createAccount({ name: "A", class: "asset", kind: "cash" });
    expect(await updateAccount(a.id, {})).toEqual({ ok: false, reason: "no-change" });
  });

  it("allows a class change while the account has no history", async () => {
    const a = await createAccount({ name: "Mislabeled", class: "asset", kind: "cash", balance: 5 });
    const res = await updateAccount(a.id, { class: "liability", clearKind: true, balance: 5 });
    expect(res).toEqual({ ok: true });
    expect(await getAccountById(a.id)).toMatchObject({ class: "liability", kind: undefined });
  });

  it("refuses a class change once snapshots exist (would rewrite history's sign)", async () => {
    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });
    await createSnapshot({ accountId: a.id, date: "2026-01-31", value: 1_000 });

    expect(await updateAccount(a.id, { class: "liability", clearKind: true })).toEqual({
      ok: false,
      reason: "class-locked",
    });
    // Untouched — still an asset.
    expect((await getAccountById(a.id))?.class).toBe("asset");
    // A non-class edit on the same account is still fine.
    expect(await updateAccount(a.id, { name: "Brokerage 2" })).toEqual({ ok: true });
  });

  it("throws on a patch that both sets and clears the same field", async () => {
    const a = await createAccount({ name: "A", class: "asset", kind: "cash" });
    await expect(
      updateAccount(a.id, { kind: "investment", clearKind: true }),
    ).rejects.toThrow(/cannot both set and clear/);
  });
});

describe("closeAccount", () => {
  it("records a value:0 snapshot then marks closed", async () => {
    const a = await createAccount({ name: "Car", class: "asset", kind: "property", balance: 8_000 });
    expect(await closeAccount(a.id, "2026-02-28")).toBe(true);

    expect((await getAccountById(a.id))?.closedAt).toBe("2026-02-28");
    expect(await listSnapshotsForAccount(a.id)).toEqual([
      { accountId: a.id, date: "2026-02-28", value: 0 },
    ]);
  });

  it("is idempotent — a second close writes no second snapshot and doesn't move closedAt", async () => {
    const a = await createAccount({ name: "Car", class: "asset", kind: "property" });
    await closeAccount(a.id, "2026-02-28");

    expect(await closeAccount(a.id, "2026-03-31")).toBe(false);
    expect((await getAccountById(a.id))?.closedAt).toBe("2026-02-28"); // unchanged
    expect(await countSnapshotsForAccount(a.id)).toBe(1); // no second zero snapshot
  });

  it("returns false for an unknown account", async () => {
    expect(await closeAccount("nope", "2026-02-28")).toBe(false);
  });
});

describe("deleteAccount", () => {
  it("hard-deletes an account with no snapshots", async () => {
    const a = await createAccount({ name: "Oops", class: "asset", kind: "cash" });
    expect(await deleteAccount(a.id)).toBe(true);
    expect(await getAccountById(a.id)).toBeUndefined();
  });

  it("refuses to delete an account that has history", async () => {
    const a = await createAccount({ name: "Keep", class: "asset", kind: "cash" });
    await createSnapshot({ accountId: a.id, date: "2026-01-31", value: 100 });

    expect(await deleteAccount(a.id)).toBe(false);
    expect(await getAccountById(a.id)).toBeDefined();
  });

  it("leaves no orphaned snapshots behind a successful delete", async () => {
    const a = await createAccount({ name: "Gone", class: "asset", kind: "cash" });
    await deleteAccount(a.id);
    // The sweep guards the count→delete race; on the happy path it's simply a no-op.
    expect(await listSnapshotsForAccount(a.id)).toEqual([]);
  });
});
