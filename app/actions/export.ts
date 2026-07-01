"use server";

import { matchesTransactionFilter } from "@/lib/budget";
import { listCategories } from "@/lib/repositories/categories";
import { listAllTransactions } from "@/lib/repositories/transactions";
import { transactionsToCsv } from "@/lib/transaction-csv";

/**
 * Builds the Settings → Data CSV export (#81 story 5/6; date-range filter added
 * in story 11). With no range it exports **every** transaction — the full-copy
 * default. An optional inclusive `dateFrom`/`dateTo` window (ISO "YYYY-MM-DD",
 * either bound optional) narrows the set before serializing, reusing the same
 * `matchesTransactionFilter` predicate the transaction list uses. The pure
 * `transactionsToCsv` serializer is unchanged — filtering happens here.
 */
export async function exportTransactionsCsvAction(range?: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<string> {
  const [transactions, categories] = await Promise.all([
    listAllTransactions(),
    listCategories(),
  ]);

  const filtered =
    range?.dateFrom || range?.dateTo
      ? transactions.filter((t) => matchesTransactionFilter(t, range))
      : transactions;

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  return transactionsToCsv(filtered, categoryNameById);
}
