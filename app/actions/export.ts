"use server";

import { listCategories } from "@/lib/repositories/categories";
import { listAllTransactions } from "@/lib/repositories/transactions";
import { transactionsToCsv } from "@/lib/transaction-csv";

/**
 * Builds the Settings → Data CSV export (#81 story 5/6). Serializes **every**
 * transaction — not the current Pulse range or filter — so the file is a
 * complete portable copy. The heavy lifting is the pure {@link transactionsToCsv}
 * serializer; this action only gathers the transactions and the category-name
 * lookup it needs and hands back the finished string for the client to download.
 */
export async function exportTransactionsCsvAction(): Promise<string> {
  const [transactions, categories] = await Promise.all([
    listAllTransactions(),
    listCategories(),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  return transactionsToCsv(transactions, categoryNameById);
}
