import { randomUUID } from "crypto";

import { COLLECTIONS } from "@/lib/db/collections";
import { monthDateRange } from "@/lib/db/dates";
import type { TransactionDocument } from "@/lib/db/documents";
import { scopedCollection } from "@/lib/db/household-scope";
import { toTransaction } from "@/lib/db/mappers";
import type { Transaction } from "@/types/budget";

export async function createTransaction(input: {
  categoryId: string;
  amount: number;
  date: string;
  vendor?: string;
  note?: string;
}): Promise<Transaction> {
  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );

  // `householdId` is stamped by the scoped collection on insert.
  const doc: TransactionDocument = {
    _id: randomUUID(),
    categoryId: input.categoryId,
    amount: input.amount,
    date: input.date,
    vendor: input.vendor,
    note: input.note,
    createdAt: new Date(),
  };

  await transactions.insertOne(doc);

  return toTransaction(doc);
}

type TransactionPatch = {
  categoryId?: string;
  amount?: number;
  date?: string;
  vendor?: string;
  // `null` explicitly clears the field (→ `$unset`), distinct from `undefined`
  // which leaves it untouched. Lets the edit form blank out an existing note.
  note?: string | null;
};

// Returns true when a matching transaction was found (and thus patched).
// Caller distinguishes hit vs miss without a separate read.
export async function updateTransaction(
  id: string,
  patch: TransactionPatch,
): Promise<boolean> {
  // Three states per key: `undefined` → omit (leave the field untouched, so a
  // partial patch doesn't clobber unrelated fields); `null` → `$unset` (clear
  // it); any other value → `$set`. Without the `$unset` path, blanking a note
  // silently reverted to the stored value.
  const set: Record<string, unknown> = {};
  const unset: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) unset[key] = "";
    else set[key] = value;
  }

  const update: Record<string, unknown> = {};
  if (Object.keys(set).length > 0) update.$set = set;
  if (Object.keys(unset).length > 0) update.$unset = unset;
  if (Object.keys(update).length === 0) return false;

  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );
  const result = await transactions.updateOne({ _id: id }, update);
  return result.matchedCount > 0;
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );
  const result = await transactions.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

// Bulk delete (issue #17 chunk 4). One `deleteMany` keeps the operation
// atomic on the server; returns the count actually removed so the caller can
// confirm how many of the requested ids existed. An empty id list is a no-op.
export async function deleteManyTransactions(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );
  const result = await transactions.deleteMany({ _id: { $in: ids } });
  return result.deletedCount;
}

// Bulk patch (issue #17 chunk 4) — bulk recategorise (`categoryId`) and bulk
// vendor rename (`vendor`) both flow through here. Mirrors `updateTransaction`'s
// undefined-stripping so an absent key is left untouched rather than written as
// `null`; returns the matched count. Empty id list or empty patch is a no-op.
export async function updateManyTransactions(
  ids: string[],
  patch: TransactionPatch,
): Promise<number> {
  if (ids.length === 0) return 0;
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  if (Object.keys(set).length === 0) return 0;

  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );
  const result = await transactions.updateMany(
    { _id: { $in: ids } },
    { $set: set },
  );
  return result.matchedCount;
}

export async function listTransactionsForMonth(
  year: number,
  month: number,
): Promise<Transaction[]> {
  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );

  const { start, end } = monthDateRange(year, month);
  const docs = await transactions
    .find({ date: { $gte: start, $lte: end } })
    .sort({ date: -1 })
    .toArray();

  return docs.map(toTransaction);
}

export async function countTransactionsForCategory(
  categoryId: string,
): Promise<number> {
  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );
  return transactions.countDocuments({ categoryId });
}

export async function listAllTransactions(): Promise<Transaction[]> {
  const transactions = await scopedCollection<TransactionDocument>(
    COLLECTIONS.transactions,
  );

  const docs = await transactions.find().sort({ date: -1 }).toArray();

  return docs.map(toTransaction);
}
