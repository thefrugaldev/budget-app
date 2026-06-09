import { randomUUID } from "crypto";

import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { monthDateRange } from "@/lib/db/dates";
import type { TransactionDocument } from "@/lib/db/documents";
import { ensureIndexes } from "@/lib/db/indexes";
import { toTransaction } from "@/lib/db/mappers";
import type { Transaction } from "@/types/budget";

export async function createTransaction(input: {
  categoryId: string;
  amount: number;
  date: string;
  vendor?: string;
  note?: string;
}): Promise<Transaction> {
  const db = await getDb();
  await ensureIndexes(db);

  const doc: TransactionDocument = {
    _id: randomUUID(),
    categoryId: input.categoryId,
    amount: input.amount,
    date: input.date,
    vendor: input.vendor,
    note: input.note,
    createdAt: new Date(),
  };

  await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .insertOne(doc);

  return toTransaction(doc);
}

type TransactionPatch = {
  categoryId?: string;
  amount?: number;
  date?: string;
  vendor?: string;
  note?: string;
};

// Returns true when a matching transaction was found (and thus patched).
// Caller distinguishes hit vs miss without a separate read.
export async function updateTransaction(
  id: string,
  patch: TransactionPatch,
): Promise<boolean> {
  // Drop explicitly-undefined keys so `$set` doesn't translate them to
  // `null` in the document. Clearing a field needs a separate `$unset`.
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) set[key] = value;
  }
  if (Object.keys(set).length === 0) return false;

  const db = await getDb();
  const result = await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .updateOne({ _id: id }, { $set: set });
  return result.matchedCount > 0;
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .deleteOne({ _id: id });
  return result.deletedCount > 0;
}

export async function listTransactionsForMonth(
  year: number,
  month: number,
): Promise<Transaction[]> {
  const db = await getDb();
  await ensureIndexes(db);

  const { start, end } = monthDateRange(year, month);
  const docs = await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .find({ date: { $gte: start, $lte: end } })
    .sort({ date: -1 })
    .toArray();

  return docs.map(toTransaction);
}

export async function countTransactionsForCategory(
  categoryId: string,
): Promise<number> {
  const db = await getDb();
  return db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .countDocuments({ categoryId });
}

export async function listAllTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  await ensureIndexes(db);

  const docs = await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .find()
    .sort({ date: -1 })
    .toArray();

  return docs.map(toTransaction);
}
