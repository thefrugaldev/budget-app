import type { Metadata } from "next";
import { Suspense } from "react";

import { RangeSelector } from "@/components/budget/shared/RangeSelector";
import { UrlFilteredTransactionList } from "@/components/budget/transaction/UrlFilteredTransactionList";
import {
  isRangePreset,
  rangeLabel,
  resolveRange,
} from "@/lib/budget";
import type { RangePreset } from "@/types/range";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listAllTransactions } from "@/lib/repositories/transactions";

export const metadata: Metadata = {
  title: "Transactions",
};

/**
 * Global `/transactions` route (issue #17 chunk 5) — replaces the PRD #14
 * placeholder. Every transaction across every category for the selected range,
 * driven by the same `?range=` convention as Pulse and the category detail
 * page. Reuses `TransactionList` in its category-less (global) mode: day
 * grouping, streak collapse, selection, and bulk actions all come from chunks
 * 2–4, with each row carrying a category pill (story 19) and the filter row
 * gaining a category multi-select (story 18).
 */
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { range: rangeParam } = await searchParams;
  await ensureSeeded();
  const [categories, transactions] = await Promise.all([
    listCategories(),
    listAllTransactions(),
  ]);

  const raw = Array.isArray(rangeParam) ? rangeParam[0] : rangeParam;
  const preset: RangePreset = isRangePreset(raw) ? raw : "this-month";
  const now = new Date();
  const range = resolveRange(preset, now);
  const rangeText = rangeLabel(preset);

  // Scope to the selected range up front; the client list handles the
  // category / vendor / text / date filtering on top of this set.
  const inRange = transactions.filter((t) => {
    const ym = t.date.slice(0, 7);
    return ym >= range.ymStart && ym <= range.ymEnd;
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28">
      <header className="mb-6">
        <h1 className="font-heading text-display font-semibold">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every transaction across every category.
        </p>
        <div className="mt-4">
          <RangeSelector active={preset} basePath="/transactions" />
        </div>
      </header>

      {/* Suspense boundary for useSearchParams inside the URL-bound list. */}
      <Suspense fallback={null}>
        <UrlFilteredTransactionList
          categories={categories}
          transactions={inRange}
          allTransactions={transactions}
          rangeText={rangeText}
          now={now}
        />
      </Suspense>
    </div>
  );
}
