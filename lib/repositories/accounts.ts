import { randomUUID } from "crypto";
import type { Filter, UpdateFilter } from "mongodb";

import { COLLECTIONS } from "@/lib/db/collections";
import type { AccountDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toAccount } from "@/lib/db/mappers";
import {
  assertNonEmptyName,
  assertValidAccountShape,
  assertValidHolding,
} from "@/lib/net-worth/validate";
import type { Account, AssetKind, Holding } from "@/types/net-worth";

import {
  countSnapshotsForAccount,
  createSnapshot,
  deleteSnapshotsForAccount,
} from "./snapshots";

/** All accounts (open and closed), sorted by name. Closed ones keep showing in history. */
export async function listAccounts(): Promise<Account[]> {
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const docs = await accounts.find().sort({ name: 1 }).toArray();
  return docs.map(toAccount);
}

export async function getAccountById(id: string): Promise<Account | undefined> {
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const doc = await accounts.findOne({ _id: id });
  return doc ? toAccount(doc) : undefined;
}

export async function createAccount(input: {
  name: string;
  class: Account["class"];
  kind?: AssetKind;
  balance?: number;
  holdings?: Holding[];
}): Promise<Account> {
  assertNonEmptyName(input.name);
  assertValidAccountShape(input);
  input.holdings?.forEach(assertValidHolding);

  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  // `householdId` is stamped by the scoped collection on insert; optionals are
  // written only when provided, so a leaked `null` never trips the readers (see
  // toAccount) — same discipline as createCategory.
  const doc: AccountDocument = {
    _id: randomUUID(),
    name: input.name,
    class: input.class,
    createdAt: new Date(),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.balance !== undefined ? { balance: input.balance } : {}),
    ...(input.holdings !== undefined ? { holdings: input.holdings } : {}),
  };
  await accounts.insertOne(doc);
  return toAccount(doc);
}

export type AccountPatch = {
  name?: string;
  class?: Account["class"];
  kind?: AssetKind;
  balance?: number;
  holdings?: Holding[];
  /** `true` clears the field via `$unset` (e.g. switching class asset↔liability). */
  clearKind?: boolean;
  clearBalance?: boolean;
  clearHoldings?: boolean;
};

/**
 * Outcome of {@link updateAccount}, so a caller can tell a missed lookup from a
 * no-op from a refused edit (rather than one ambiguous `false`):
 * - `not-found` — no account with that id.
 * - `no-change` — the patch resolved to nothing to write.
 * - `class-locked` — a `class` change was refused because history exists.
 */
export type UpdateAccountResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "no-change" | "class-locked" };

/** A patch that both sets and clears the same field is contradictory (a caller bug). */
function assertNoConflictingClears(patch: AccountPatch): void {
  if (
    (patch.clearKind && patch.kind !== undefined) ||
    (patch.clearBalance && patch.balance !== undefined) ||
    (patch.clearHoldings && patch.holdings !== undefined)
  ) {
    throw new Error("An account patch cannot both set and clear the same field.");
  }
}

/**
 * Edit an account (rename, correct class/kind, adjust balance/holdings). Reads
 * the current doc, applies the patch, and re-validates the *resulting* shape, so
 * the asset-needs-a-kind / liability-has-no-kind invariant holds after any edit —
 * not just at create.
 *
 * **`class` is immutable once history exists.** `monthlyNetWorthSeries` signs
 * every past snapshot by the account's *current* class, so flipping
 * asset↔liability would silently rewrite the sign of every recorded month.
 * Correct a class mistake before snapshots accrue; afterwards, close the account
 * and create a new one (history stays with the old one). `closeAccount` owns the
 * close transition, so `closedAt` isn't patchable here.
 */
export async function updateAccount(
  id: string,
  patch: AccountPatch,
): Promise<UpdateAccountResult> {
  assertNoConflictingClears(patch);
  if (patch.name !== undefined) assertNonEmptyName(patch.name);
  patch.holdings?.forEach(assertValidHolding);

  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const current = await accounts.findOne({ _id: id });
  if (!current) return { ok: false, reason: "not-found" };

  const wantsClassChange = patch.class !== undefined && patch.class !== current.class;
  if (wantsClassChange && (await countSnapshotsForAccount(id)) > 0) {
    return { ok: false, reason: "class-locked" };
  }

  const nextClass = patch.class ?? current.class;
  const nextKind = patch.clearKind ? undefined : (patch.kind ?? current.kind);
  assertValidAccountShape({ class: nextClass, kind: nextKind });

  const set: Partial<AccountDocument> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.class !== undefined) set.class = patch.class;
  if (patch.kind !== undefined) set.kind = patch.kind;
  if (patch.balance !== undefined) set.balance = patch.balance;
  if (patch.holdings !== undefined) set.holdings = patch.holdings;

  const unset: Record<string, ""> = {};
  if (patch.clearKind) unset.kind = "";
  if (patch.clearBalance) unset.balance = "";
  if (patch.clearHoldings) unset.holdings = "";

  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
    return { ok: false, reason: "no-change" };
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  await accounts.updateOne({ _id: id }, update);
  return { ok: true };
}

/**
 * Holdings are edited with **atomic array operators** rather than reading the
 * whole `holdings[]`, mutating it in memory, and writing it back (#140). The
 * read-modify-write let two concurrent edits race — the second full-array write
 * clobbered the first (lost update). A `$push` / positional `$` / `$pull` each
 * touch only the one element, so concurrent edits to *different* holdings in the
 * same account both land. The per-holding validity check still runs on the input
 * (`assertValidHolding`), and the one-symbol-per-account rule is enforced *in the
 * write* by the `$ne` filter guard below — so atomicity costs us none of the
 * validation the old read-then-write did.
 */

/**
 * Add a holding (story 4). The `"holdings.ticker": { $ne }` filter makes the push
 * happen only when the symbol isn't already present, enforcing uniqueness
 * atomically. A miss is either a duplicate ticker or a vanished account (a
 * concurrent delete); one follow-up read disambiguates for the caller's message.
 */
export async function addHolding(
  id: string,
  holding: Holding,
): Promise<"added" | "duplicate" | "not-found"> {
  assertValidHolding(holding);
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const res = await accounts.updateOne(
    { _id: id, "holdings.ticker": { $ne: holding.ticker } } as Filter<AccountDocument>,
    { $push: { holdings: holding } } as UpdateFilter<AccountDocument>,
  );
  if (res.matchedCount === 1) return "added";
  return (await accounts.findOne({ _id: id })) ? "duplicate" : "not-found";
}

/**
 * Update one holding in place, keyed by ticker (story 18). The positional `$`
 * targets the matched element, so a concurrent edit to another holding survives.
 * Clearing the override (`priceOverride` undefined) `$unset`s it, reverting the
 * holding to the feed price. Returns false when the ticker isn't in the account.
 */
export async function updateHolding(
  id: string,
  ticker: string,
  fields: { quantity: number; priceOverride?: number },
): Promise<boolean> {
  assertValidHolding({
    ticker,
    quantity: fields.quantity,
    ...(fields.priceOverride !== undefined ? { priceOverride: fields.priceOverride } : {}),
  });
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const set: Record<string, unknown> = { "holdings.$.quantity": fields.quantity };
  const update: Record<string, unknown> = { $set: set };
  if (fields.priceOverride !== undefined) set["holdings.$.priceOverride"] = fields.priceOverride;
  else update.$unset = { "holdings.$.priceOverride": "" };

  const res = await accounts.updateOne(
    { _id: id, "holdings.ticker": ticker } as Filter<AccountDocument>,
    update as UpdateFilter<AccountDocument>,
  );
  return res.matchedCount === 1;
}

/**
 * Remove a holding by ticker (story 18 — a sold position). `$pull` is atomic, so
 * a concurrent edit to another holding isn't lost. Returns false when nothing was
 * removed (the ticker wasn't there, or the account is gone).
 */
export async function removeHolding(id: string, ticker: string): Promise<boolean> {
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const res = await accounts.updateOne(
    { _id: id } as Filter<AccountDocument>,
    { $pull: { holdings: { ticker } } } as UpdateFilter<AccountDocument>,
  );
  return res.modifiedCount === 1;
}

/**
 * Close an account: record a final `value: 0` snapshot, then mark it closed.
 * The snapshot is written **first, on purpose** — a partial failure then leaves
 * the account open (still in the headline) rather than closed-without-a-closing
 * snapshot, which would make `monthlyNetWorthSeries` over-report it forever
 * (that series is defined purely over snapshots and never reads `closedAt`).
 *
 * Idempotent: an already-closed account is a no-op returning false, so a second
 * call (e.g. a double-click or a second tab) can't stack a second zero snapshot
 * or move `closedAt`. Also returns false when no account matches. (A concurrent
 * double-close across two tabs is a narrow residual race on a single-user app;
 * the `closedAt` check collapses the common case.)
 */
export async function closeAccount(id: string, closedAtDate: string): Promise<boolean> {
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const existing = await accounts.findOne({ _id: id });
  if (!existing || existing.closedAt) return false;

  await createSnapshot({ accountId: id, date: closedAtDate, value: 0 });
  const result = await accounts.updateOne({ _id: id }, { $set: { closedAt: closedAtDate } });
  return result.matchedCount > 0;
}

/**
 * Hard-delete an account, **only when it has no snapshots** — an account with
 * recorded history is closed (see {@link closeAccount}), never deleted, so the
 * trajectory chart keeps its past. Returns false when it has history (nothing
 * deleted) or no account matches.
 *
 * After a successful delete we sweep any snapshots for that id: if one slipped
 * in between the count and the delete (a concurrent close from another tab), it
 * would otherwise be orphaned from its account. Mirrors the archive apply CLI's
 * orphan sweep.
 */
export async function deleteAccount(id: string): Promise<boolean> {
  if ((await countSnapshotsForAccount(id)) > 0) return false;

  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const result = await accounts.deleteOne({ _id: id });
  if (result.deletedCount === 0) return false;

  await deleteSnapshotsForAccount(id);
  return true;
}
