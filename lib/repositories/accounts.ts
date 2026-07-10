import { randomUUID } from "crypto";

import { COLLECTIONS } from "@/lib/db/collections";
import type { AccountDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toAccount } from "@/lib/db/mappers";
import { assertValidAccountShape } from "@/lib/net-worth/validate";
import type { Account, AssetKind, Holding } from "@/types/net-worth";

import { countSnapshotsForAccount, createSnapshot } from "./snapshots";

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
  assertValidAccountShape(input);

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
 * Edit an account (rename, correct class/kind, adjust balance/holdings). Reads
 * the current doc, applies the patch, and re-validates the *resulting* shape, so
 * the asset-needs-a-kind / liability-has-no-kind invariant holds after any edit —
 * not just at create. Returns false when no account matches. `closeAccount`
 * owns the close transition (it also records the zero snapshot), so `closedAt`
 * isn't patchable here.
 */
export async function updateAccount(id: string, patch: AccountPatch): Promise<boolean> {
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const current = await accounts.findOne({ _id: id });
  if (!current) return false;

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

  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) return false;

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;

  const result = await accounts.updateOne({ _id: id }, update);
  return result.matchedCount > 0;
}

/**
 * Close an account: record a final `value: 0` snapshot, then mark it closed.
 * The snapshot is written **first, on purpose** — a partial failure then leaves
 * the account open (still in the headline) rather than closed-without-a-closing
 * snapshot, which would make `monthlyNetWorthSeries` over-report it forever
 * (that series is defined purely over snapshots and never reads `closedAt`).
 * Returns false when no account matches.
 */
export async function closeAccount(id: string, closedAtDate: string): Promise<boolean> {
  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const existing = await accounts.findOne({ _id: id });
  if (!existing) return false;

  await createSnapshot({ accountId: id, date: closedAtDate, value: 0 });
  const result = await accounts.updateOne({ _id: id }, { $set: { closedAt: closedAtDate } });
  return result.matchedCount > 0;
}

/**
 * Hard-delete an account, **only when it has no snapshots** — an account with
 * recorded history is closed (see {@link closeAccount}), never deleted, so the
 * trajectory chart keeps its past. Returns false when it has history (nothing
 * deleted) or no account matches.
 */
export async function deleteAccount(id: string): Promise<boolean> {
  if ((await countSnapshotsForAccount(id)) > 0) return false;

  const accounts = await scopedCollection<AccountDocument>(COLLECTIONS.accounts);
  const result = await accounts.deleteOne({ _id: id });
  return result.deletedCount > 0;
}
