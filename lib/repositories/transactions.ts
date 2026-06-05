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
  note?: string;
}): Promise<Transaction> {
  const db = await getDb();
  await ensureIndexes(db);

  const doc: TransactionDocument = {
    _id: randomUUID(),
    categoryId: input.categoryId,
    amount: input.amount,
    date: input.date,
    note: input.note,
    createdAt: new Date(),
  };

  await db
    .collection<TransactionDocument>(COLLECTIONS.transactions)
    .insertOne(doc);

  return toTransaction(doc);
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
