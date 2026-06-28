"use client";

import { TransactionList } from "@/components/budget/transaction/TransactionList";
import { useTransactionFilterParams } from "@/hooks/useTransactionFilterParams";
import type { Category, Transaction } from "@/types/budget";

/**
 * URL-bound wrapper for the global `/transactions` list (story 8 of #79). Keeps
 * the server page a server component: it owns the data fetch and range scoping,
 * while this thin client boundary reads the filter from the query string and
 * writes edits back via soft navigation. The category-detail list renders
 * `TransactionList` directly and keeps its filter in local state.
 */
export function UrlFilteredTransactionList({
  categories,
  transactions,
  allTransactions,
  rangeText,
  now,
}: {
  categories: Category[];
  transactions: Transaction[];
  allTransactions: Transaction[];
  rangeText: string;
  now: Date;
}) {
  const [filter, setFilter] = useTransactionFilterParams();
  return (
    <TransactionList
      categories={categories}
      transactions={transactions}
      allTransactions={allTransactions}
      rangeText={rangeText}
      now={now}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
