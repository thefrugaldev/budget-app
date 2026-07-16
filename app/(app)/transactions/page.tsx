import type { Metadata } from "next";
import { Suspense } from "react";

import { AddMenu } from "@/components/budget/shared/AddMenu";
import { DateScopeSelector } from "@/components/budget/shared/DateScopeSelector";
import { UrlFilteredTransactionList } from "@/components/budget/transaction/UrlFilteredTransactionList";
import { requireHouseholdId } from "@/lib/auth/session";
import { ensureSeeded } from "@/lib/db/seed";
import { listCategories } from "@/lib/repositories/categories";
import { listAllTransactions } from "@/lib/repositories/transactions";

export const metadata: Metadata = {
  title: "Transactions",
};

/**
 * Global `/transactions` route. Every transaction across every category; the
 * date window is chosen client-side by the unified `DateScopeSelector` (issue
 * #165 chunk 5) rather than the old server `?range=` scoping — the page ships
 * the full set once and the client windows it locally, so scope changes and
 * per-keystroke filtering both stay off the server (chunk 1). Reuses
 * `TransactionList` in its category-less (global) mode: day grouping, streak
 * collapse, selection, and bulk actions, with each row carrying a category pill
 * (story 19) and the filter row gaining a category multi-select (story 18).
 */
export default async function TransactionsPage() {
  await ensureSeeded(await requireHouseholdId());
  const [categories, transactions] = await Promise.all([
    listCategories(),
    listAllTransactions(),
  ]);

  const now = new Date();
  // Oldest transaction date anchors the "All time" chip so it reaches the full
  // imported history (#118, 2020→). Cheap single pass; empty set → no chip.
  const earliestDate = transactions.reduce<string | undefined>(
    (min, t) => (min === undefined || t.date < min ? t.date : min),
    undefined,
  );

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
          {/* useSearchParams inside the client scope control needs Suspense. */}
          <Suspense fallback={null}>
            <DateScopeSelector now={now} earliestDate={earliestDate} />
          </Suspense>
        </div>
      </header>

      {/* Suspense boundary for useSearchParams inside the URL-bound list. */}
      <Suspense fallback={null}>
        <UrlFilteredTransactionList
          categories={categories}
          transactions={transactions}
          now={now}
        />
      </Suspense>

      {/* Quick entry from the other working surface (#166 story 12).
          Desktop-only + self-hides for viewers. */}
      <AddMenu categories={categories} transactions={transactions} />
    </div>
  );
}
