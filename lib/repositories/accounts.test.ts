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
  addHolding,
  closeAccount,
  createAccount,
  deleteAccount,
  getAccountById,
  listAccounts,
  listInstitutions,
  removeHolding,
  updateAccount,
  updateHolding,
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

  it("persists institution only when provided (#195)", async () => {
    const withInst = await createAccount({
      name: "Brokerage",
      class: "asset",
      kind: "investment",
      institution: "Vanguard",
    });
    expect(withInst.institution).toBe("Vanguard");
    expect(await getAccountById(withInst.id)).toEqual(withInst);

    // Omitted → the field is absent on both the domain object and the stored doc
    // (not a stored `null`/`""`), so autocomplete never surfaces an empty value.
    const without = await createAccount({ name: "HYSA", class: "asset", kind: "cash", balance: 1 });
    expect(without.institution).toBeUndefined();
    const raw = await mongo.db
      .collection<{ _id: string } & Record<string, unknown>>("accounts")
      .findOne({ _id: without.id });
    expect(raw && "institution" in raw).toBe(false);
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

  it("sets a new institution and clears it via clearInstitution ($unset) (#195)", async () => {
    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });

    // Backfill an institution on an account that had none.
    expect(await updateAccount(a.id, { institution: "Fidelity" })).toEqual({ ok: true });
    expect((await getAccountById(a.id))?.institution).toBe("Fidelity");

    // Clearing $unsets it — the field is gone from the stored doc, not blanked to "".
    expect(await updateAccount(a.id, { clearInstitution: true })).toEqual({ ok: true });
    expect((await getAccountById(a.id))?.institution).toBeUndefined();
    const raw = await mongo.db
      .collection<{ _id: string } & Record<string, unknown>>("accounts")
      .findOne({ _id: a.id });
    expect(raw && "institution" in raw).toBe(false);
  });

  it("throws when a patch both sets and clears institution", async () => {
    const a = await createAccount({ name: "A", class: "asset", kind: "cash" });
    await expect(
      updateAccount(a.id, { institution: "Ally", clearInstitution: true }),
    ).rejects.toThrow(/cannot both set and clear/);
  });
});

describe("holdings — atomic add / update / remove (#140)", () => {
  const holdingsOf = async (id: string) => (await getAccountById(id))?.holdings ?? [];

  it("adds a holding, rejects a duplicate ticker, and reports a missing account", async () => {
    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });
    expect(await addHolding(a.id, { ticker: "VOO", quantity: 10 })).toBe("added");
    expect(await holdingsOf(a.id)).toEqual([{ ticker: "VOO", quantity: 10 }]);

    // Same symbol again is refused in the write itself — array is unchanged.
    expect(await addHolding(a.id, { ticker: "VOO", quantity: 99 })).toBe("duplicate");
    expect(await holdingsOf(a.id)).toEqual([{ ticker: "VOO", quantity: 10 }]);

    expect(await addHolding("nope", { ticker: "AAPL", quantity: 1 })).toBe("not-found");
  });

  it("validates the holding before writing", async () => {
    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });
    await expect(addHolding(a.id, { ticker: "VOO", quantity: -1 })).rejects.toThrow(/quantity/);
    expect(await holdingsOf(a.id)).toEqual([]);
  });

  it("updates a holding in place and clears the override on demand", async () => {
    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });
    await addHolding(a.id, { ticker: "VOO", quantity: 10, priceOverride: 450 });

    expect(await updateHolding(a.id, "VOO", { quantity: 12, priceOverride: 460 })).toBe(true);
    expect(await holdingsOf(a.id)).toEqual([{ ticker: "VOO", quantity: 12, priceOverride: 460 }]);

    // Clearing the override $unsets it — the holding reverts to the feed price.
    expect(await updateHolding(a.id, "VOO", { quantity: 12 })).toBe(true);
    expect(await holdingsOf(a.id)).toEqual([{ ticker: "VOO", quantity: 12 }]);

    // Unknown ticker → no match.
    expect(await updateHolding(a.id, "AAPL", { quantity: 1 })).toBe(false);
  });

  it("removes a holding and reports a no-op for an absent ticker", async () => {
    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });
    await addHolding(a.id, { ticker: "VOO", quantity: 10 });
    await addHolding(a.id, { ticker: "AAPL", quantity: 3 });

    expect(await removeHolding(a.id, "VOO")).toBe(true);
    expect(await holdingsOf(a.id)).toEqual([{ ticker: "AAPL", quantity: 3 }]);
    expect(await removeHolding(a.id, "VOO")).toBe(false); // already gone
  });

  it("does not lose a concurrent add of a different ticker (the #140 fix)", async () => {
    const a = await createAccount({
      name: "Brokerage",
      class: "asset",
      kind: "investment",
      holdings: [{ ticker: "VOO", quantity: 10 }],
    });

    // Two adds racing: the read-modify-write this replaced would drop one; the
    // atomic $push lands both.
    const [x, y] = await Promise.all([
      addHolding(a.id, { ticker: "AAPL", quantity: 1 }),
      addHolding(a.id, { ticker: "MSFT", quantity: 2 }),
    ]);
    expect([x, y]).toEqual(["added", "added"]);
    const tickers = (await holdingsOf(a.id)).map((h) => h.ticker).sort();
    expect(tickers).toEqual(["AAPL", "MSFT", "VOO"]);
  });

  it("does not lose a concurrent update to a different holding (the #140 fix)", async () => {
    const a = await createAccount({
      name: "Brokerage",
      class: "asset",
      kind: "investment",
      holdings: [
        { ticker: "VOO", quantity: 10 },
        { ticker: "AAPL", quantity: 3 },
      ],
    });

    const [u1, u2] = await Promise.all([
      updateHolding(a.id, "VOO", { quantity: 11 }),
      updateHolding(a.id, "AAPL", { quantity: 4 }),
    ]);
    expect([u1, u2]).toEqual([true, true]);
    // Both edits land — the positional `$` touches only its own element.
    expect(await holdingsOf(a.id)).toEqual([
      { ticker: "VOO", quantity: 11 },
      { ticker: "AAPL", quantity: 4 },
    ]);
  });

  it("refuses to push a holding onto a non-investment account", async () => {
    const cash = await createAccount({ name: "Ally", class: "asset", kind: "cash", balance: 100 });
    expect(await addHolding(cash.id, { ticker: "VOO", quantity: 1 })).toBe("not-found");
    expect((await getAccountById(cash.id))?.holdings).toBeUndefined();
  });

  it("keeps a ticker unique under a concurrent double-add of the same symbol", async () => {
    const a = await createAccount({ name: "Brokerage", class: "asset", kind: "investment" });
    const results = (
      await Promise.all([
        addHolding(a.id, { ticker: "VOO", quantity: 10 }),
        addHolding(a.id, { ticker: "VOO", quantity: 20 }),
      ])
    ).sort();
    // Exactly one wins; the other is refused — never two VOO rows.
    expect(results).toEqual(["added", "duplicate"]);
    expect(await holdingsOf(a.id)).toHaveLength(1);
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

describe("listInstitutions (#195)", () => {
  it("returns distinct, sorted institution values, dropping accounts with none", async () => {
    await createAccount({ name: "Roth", class: "asset", kind: "investment", institution: "Vanguard" });
    await createAccount({ name: "401k", class: "asset", kind: "investment", institution: "Fidelity" });
    // A second account at Vanguard — the value collapses to one suggestion.
    await createAccount({ name: "Brokerage", class: "asset", kind: "investment", institution: "Vanguard" });
    // A liability carries an institution too (story 4) and is grouped in.
    await createAccount({ name: "Mortgage", class: "liability", balance: 200_000, institution: "Ally" });
    // No institution → contributes nothing (no empty/undefined suggestion).
    await createAccount({ name: "HYSA", class: "asset", kind: "cash", balance: 5 });

    expect(await listInstitutions()).toEqual(["Ally", "Fidelity", "Vanguard"]);
  });

  it("is empty when no account has an institution", async () => {
    await createAccount({ name: "HYSA", class: "asset", kind: "cash", balance: 5 });
    expect(await listInstitutions()).toEqual([]);
  });

  it("scopes to the household — another household's institutions are invisible", async () => {
    await createAccount({ name: "Roth", class: "asset", kind: "investment", institution: "Vanguard" });
    // Seed a foreign-household account directly, past the scoped seam.
    await mongo.db
      .collection<{ _id: string } & Record<string, unknown>>("accounts")
      .insertOne({
        _id: "other-acct",
        householdId: "hh-other",
        name: "Foreign Brokerage",
        class: "asset",
        kind: "investment",
        institution: "Schwab",
        createdAt: new Date(),
      });

    // Only this household's institution surfaces — never "Schwab".
    expect(await listInstitutions()).toEqual(["Vanguard"]);
  });
});
